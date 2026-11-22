#!/usr/bin/env python3
"""Validate user settings against an administrator-published manifest; generate C++ macros."""
import argparse
import base64
import json
import pathlib
import re
import shutil

BOARDS = {
    'uno': ('arduino:avr:uno', 'arduino:avr', ''),
    'nano': ('arduino:avr:nano:cpu=atmega328', 'arduino:avr', ''),
    'nano_old': ('arduino:avr:nano:cpu=atmega328old', 'arduino:avr', ''),
    'rf_nano': ('arduino:avr:nano:cpu=atmega328', 'arduino:avr', ''),
    'rf_nano_old': ('arduino:avr:nano:cpu=atmega328old', 'arduino:avr', ''),
    'mega': ('arduino:avr:mega:cpu=atmega2560', 'arduino:avr', ''),
    'leonardo': ('arduino:avr:leonardo', 'arduino:avr', ''),
    'esp32': ('esp32:esp32:esp32', 'esp32:esp32', 'https://espressif.github.io/arduino-esp32/package_esp32_index.json'),
    'esp8266': ('esp8266:esp8266:nodemcuv2', 'esp8266:esp8266', 'https://arduino.esp8266.com/stable/package_esp8266com_index.json')
}
SLUG = re.compile(r'^[a-z0-9][a-z0-9-]{0,49}$')
VARIABLE = re.compile(r'^[A-Z][A-Z0-9_]{1,39}$')

def validate_fields(manifest, board, config):
    if board not in BOARDS or board not in manifest.get('boards', []):
        raise ValueError('Board chưa được quản trị viên hỗ trợ')
    fields = manifest.get('fields', [])
    if not isinstance(fields, list) or len(fields) > 40:
        raise ValueError('Danh sách biến không hợp lệ')
    result, allowed = {}, set()
    for field in fields:
        key = field.get('key')
        if not isinstance(key, str) or not VARIABLE.fullmatch(key) or key in allowed:
            raise ValueError('Trường cấu hình bị trùng hoặc không hợp lệ')
        allowed.add(key)
        value = config.get(key, field.get('default'))
        kind = field.get('type')
        if kind in ('pin', 'integer'):
            if type(value) is not int:
                raise ValueError(key + ': cần số nguyên')
            low, high = field.get('min', 0), field.get('max', 1000000)
            if type(low) is not int or type(high) is not int or not low <= value <= high:
                raise ValueError(key + ': vượt giới hạn')
            if kind == 'pin':
                maxpin = 13 if board in ('uno','nano','nano_old','rf_nano','rf_nano_old') else 53 if board == 'mega' else 19 if board == 'leonardo' else 39 if board == 'esp32' else 16
                if not 2 <= value <= maxpin:
                    raise ValueError(key + ': chân không dùng được trên board đã chọn')
            result[key] = str(value)
        elif kind in ('string', 'address'):
            if not isinstance(value, str) or len(value) > min(int(field.get('maxLength', 64)), 128) or '\x00' in value:
                raise ValueError(key + ': chuỗi không hợp lệ')
            if kind == 'address' and not re.fullmatch(r'[A-Za-z0-9 ._:/-]{1,128}', value):
                raise ValueError(key + ': địa chỉ không hợp lệ')
            result[key] = json.dumps(value, ensure_ascii=True)
        elif kind == 'boolean':
            if type(value) is not bool:
                raise ValueError(key + ': true/false')
            result[key] = 'true' if value else 'false'
        elif kind == 'choice':
            if type(value) not in (str, int) or value not in field.get('options', []):
                raise ValueError(key + ': giá trị không được phép')
            result[key] = json.dumps(value, ensure_ascii=True) if type(value) is str else str(value)
        else:
            raise ValueError(key + ': kiểu dữ liệu chưa hỗ trợ')
    if set(config) - allowed:
        raise ValueError('Phát hiện biến người dùng không được phép chỉnh sửa')
    return result

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--project', required=True)
    parser.add_argument('--board', required=True)
    parser.add_argument('--config-b64', required=True)
    args = parser.parse_args()
    if not SLUG.fullmatch(args.project) or args.board not in BOARDS:
        raise ValueError('Project/board không hợp lệ')
    if len(args.config_b64) > 16000:
        raise ValueError('Cấu hình quá lớn')
    root = pathlib.Path(__file__).resolve().parents[1]
    directory = root / 'projects' / args.project
    manifest = json.loads((directory / 'manifest.json').read_text('utf-8'))
    if not manifest.get('published') or manifest.get('id') != args.project:
        raise ValueError('Chương trình chưa được phát hành')
    config = json.loads(base64.b64decode(args.config_b64, validate=True).decode('utf-8'))
    if not isinstance(config, dict):
        raise ValueError('Cấu hình JSON không hợp lệ')
    values = validate_fields(manifest, args.board, config)
    target = root / 'build' / 'AppDockSketch'
    target.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(directory / 'AppDockSketch.ino', target / 'AppDockSketch.ino')
    (target / 'generated_config.h').write_text(
        '#pragma once\n' + ''.join(f'#define {key} {value}\n' for key,value in values.items()), encoding='utf-8')
    fqbn, core, url = BOARDS[args.board]
    (root / 'build' / 'selection.json').write_text(json.dumps({
        'project': args.project, 'board': args.board, 'fqbn': fqbn, 'core': core,
        'additional_url': url, 'version': manifest.get('version','1.0.0')
    }), encoding='utf-8')
    print('Prepared', args.project, fqbn, 'with', len(values), 'approved parameters')

if __name__ == '__main__':
    main()
