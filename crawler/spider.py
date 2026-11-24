#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""名师数据采集脚本（面试演示）

能力：
1. 数据源支持本地 HTML 文件或远程 URL
2. requests + BeautifulSoup(lxml) 解析，失败自动重试
3. 反爬基础：随机 UA、指数退避、请求间隔、可选代理
4. 数据清洗：粉丝量文本转数字、标签去重、空白规范化、按姓名去重
5. 输出 JSON，可选写入 MySQL（按姓名 upsert）

使用示例：
    python spider.py
    python spider.py --source https://example.com/teachers --delay 1.5
    python spider.py --source fixtures/teachers.html --mysql
    CRAWL_PROXY=http://127.0.0.1:7890 python spider.py --source https://example.com/teachers

MySQL 环境变量（与 server/.env 保持一致）：
    DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME
"""
import argparse
import json
import os
import random
import re
import sys
import time
from collections import Counter

import requests
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

try:
    import pymysql
except ImportError:  # 仅在使用 --mysql 时强制要求
    pymysql = None

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_SOURCE = os.path.join(BASE_DIR, 'fixtures', 'teachers.html')
DEFAULT_OUT = os.path.join(BASE_DIR, 'output', 'teachers.json')

USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
    '(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 '
    '(KHTML, like Gecko) Version/17.4 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 '
    '(KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
]

FANS_RE = re.compile(r'([0-9]+(?:\.[0-9]+)?)\s*(亿|万|[wW])?')
FANS_UNITS = {'w': 10000, 'W': 10000, '万': 10000, '亿': 100000000}


def clean_text(value):
    """压缩空白并去掉首尾空格。"""
    return re.sub(r'\s+', ' ', str(value or '')).strip()


def parse_fans(text):
    """把 '1684.2w+'、'1,250万'、'2.1亿' 统一转成整数粉丝量。"""
    normalized = clean_text(text).replace(',', '')
    match = FANS_RE.search(normalized)
    if not match:
        return 0
    number = float(match.group(1))
    unit = match.group(2) or ''
    return int(number * FANS_UNITS.get(unit, 1))


def build_session(proxy=None):
    """创建带重试、随机 UA、可选代理的 Session。"""
    retry = Retry(
        total=3,
        backoff_factor=0.8,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=frozenset(['GET', 'HEAD']),
    )
    adapter = HTTPAdapter(max_retries=retry, pool_connections=10, pool_maxsize=10)

    session = requests.Session()
    session.mount('http://', adapter)
    session.mount('https://', adapter)
    session.headers.update(
        {
            'User-Agent': random.choice(USER_AGENTS),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.6',
        }
    )

    if proxy:
        session.proxies.update({'http': proxy, 'https': proxy})

    return session


def load_html(source, session, timeout):
    """本地文件直接读取，远程地址走 Session（含重试）。"""
    if os.path.exists(source):
        with open(source, 'r', encoding='utf-8') as file:
            return file.read()

    if not re.match(r'^https?://', source):
        raise ValueError('数据源必须是本地文件路径或 http(s) URL')

    response = session.get(source, timeout=timeout)
    response.raise_for_status()
    if not response.encoding or response.encoding.lower() == 'iso-8859-1':
        response.encoding = response.apparent_encoding or 'utf-8'
    return response.text


def parse_teachers(html):
    """按页面结构解析名师卡片，做字段清洗。"""
    soup = BeautifulSoup(html, 'lxml')
    items = []

    for card in soup.select('li.teacher-card'):
        name_el = card.select_one('.name')
        name = clean_text(name_el.get_text()) if name_el else ''
        if not name:
            continue

        tags = []
        for tag_el in card.select('.tags li'):
            tag = clean_text(tag_el.get_text())
            if tag:
                tags.append(tag)
        tags = list(dict.fromkeys(tags))

        stage = clean_text(card.get('data-stage')) or (tags[0] if tags else '')
        subject = clean_text(card.get('data-subject'))
        title_el = card.select_one('.title')
        fans_el = card.select_one('.fans')
        intro_el = card.select_one('.intro')

        items.append(
            {
                'name': name,
                'title': clean_text(title_el.get_text()) if title_el else '',
                'stage': stage,
                'subject': subject,
                'tags': tags,
                'fans': parse_fans(fans_el.get_text() if fans_el else ''),
                'intro': clean_text(intro_el.get_text()) if intro_el else '',
            }
        )

    return items


def dedupe_by_name(items):
    """按姓名去重，保留首次出现的记录。"""
    seen = set()
    result = []
    for item in items:
        if item['name'] in seen:
            continue
        seen.add(item['name'])
        result.append(item)
    return result


def save_json(items, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as file:
        json.dump(items, file, ensure_ascii=False, indent=2)
    print(f'[json] 已写入 {path}（{len(items)} 条）')


def save_mysql(items):
    """按姓名 upsert 到 teachers 表，依赖 uk_name 唯一索引。"""
    if pymysql is None:
        raise RuntimeError('未安装 PyMySQL，请执行 pip install -r requirements.txt')

    conn = pymysql.connect(
        host=os.getenv('DB_HOST', '127.0.0.1'),
        port=int(os.getenv('DB_PORT', '3306')),
        user=os.getenv('DB_USER', 'root'),
        password=os.getenv('DB_PASSWORD', 'root'),
        database=os.getenv('DB_NAME', 'teacher_mcn'),
        charset='utf8mb4',
        autocommit=False,
    )

    sql = (
        'INSERT INTO teachers '
        '(name, title, stage, subject, tags, fans, intro, highlights, courses, years) '
        'VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s) '
        'ON DUPLICATE KEY UPDATE '
        'title = VALUES(title), stage = VALUES(stage), subject = VALUES(subject), '
        'tags = VALUES(tags), fans = VALUES(fans), intro = VALUES(intro)'
    )

    inserted = 0
    updated = 0

    try:
        with conn.cursor() as cursor:
            for item in items:
                cursor.execute(
                    sql,
                    (
                        item['name'],
                        item['title'],
                        item['stage'],
                        item['subject'],
                        json.dumps(item['tags'], ensure_ascii=False),
                        item['fans'],
                        item['intro'],
                        json.dumps([], ensure_ascii=False),
                        json.dumps([], ensure_ascii=False),
                        0,
                    ),
                )
                if cursor.rowcount == 1:
                    inserted += 1
                elif cursor.rowcount == 2:
                    updated += 1
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    print(f'[mysql] 新增 {inserted} 条，更新 {updated} 条')


def print_summary(raw_items, items):
    stages = Counter(item['stage'] or '未知' for item in items)
    total_fans = sum(item['fans'] for item in items)
    average = total_fans / len(items) if items else 0

    print(f'[crawl] 原始 {len(raw_items)} 条，去重后 {len(items)} 条')
    print(f'[crawl] 学段分布: {dict(stages)}')
    print(f'[crawl] 粉丝总量: {total_fans:,}，平均: {average:,.0f}')


def main():
    parser = argparse.ArgumentParser(description='名师数据采集脚本')
    parser.add_argument('--source', default=DEFAULT_SOURCE, help='本地 HTML 或远程 URL')
    parser.add_argument('--out', default=DEFAULT_OUT, help='JSON 输出路径')
    parser.add_argument('--mysql', action='store_true', help='写入 MySQL（按姓名 upsert）')
    parser.add_argument('--delay', type=float, default=0.8, help='远程请求前的等待秒数')
    parser.add_argument('--timeout', type=float, default=15, help='请求超时秒数')
    parser.add_argument('--proxy', default=os.getenv('CRAWL_PROXY', ''), help='可选代理地址')
    parser.add_argument('--limit', type=int, default=0, help='最多保留条数，0 表示不限')
    args = parser.parse_args()

    session = build_session(args.proxy or None)

    if not os.path.exists(args.source):
        time.sleep(max(args.delay, 0))

    html = load_html(args.source, session, args.timeout)
    raw_items = parse_teachers(html)
    items = dedupe_by_name(raw_items)

    if args.limit > 0:
        items = items[: args.limit]

    print_summary(raw_items, items)

    if not items:
        print('[crawl] 未解析到数据，请检查页面结构或选择器', file=sys.stderr)
        return 1

    save_json(items, args.out)

    if args.mysql:
        save_mysql(items)

    return 0


if __name__ == '__main__':
    sys.exit(main())
