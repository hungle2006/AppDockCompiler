#!/usr/bin/env python3
"""Build trusted admin-owned sketch using validated, data-only configuration."""
import argparse
import base64
import json
import pathlib
import re
import shutil

BOARDS = {x['id']: x for x in json.loads((pathlib.Path(__file__).resolve().parents[1] / 'boards' / 'boards.json').read_text('utf-8'))}
IDENT = re.compile(r'^[A-Z][A-Z0-9_]{1,39}$')
SLUG = re.compile(r'^[a-z0-9][a-z0-9-]{0,49}$')


def validate_fields(manifest, board, config):
    if board not in BOARDS or board not in manifest.get('boards', []):
        raise ValueError('Board không hỗ trợ chương trình này')
    fields = manifest.get('fields', [])
    if not isinstance(fields, list) or not (0 <= len(fields) <= 40):
        raise ValueError('Định nghĩa biến không hợp lệ')
    allowed = set()
    output = {}
    for field in fields:
        key = field.get('key')
        if not isinstance(key, str) or not IDENT.fullmatch(key) or key in allowed:
            raise ValueError('Tên biến bị trùng hoặc không hợp lệ')
        allowed.add(key)
        kind = field.get('type')
        value = config.get(key, field.get('default'))
        if kind in ('integer', 'pin'):
            if type(value) is not int:
                raise ValueError(key + ': phải là số nguyên')
            minval, maxval = field.get('min', 0), field.get('max', 1000000)
            if type(minval) is not int or type(maxval) is not int or not minval <= value <= maxval:
                raise ValueError(key + ': vượt giới hạn')
            # Prevent 40+ GPIO on AVR; board-specific validation must override generic UI ranges.
            if kind == 'pin':
                upper = BOARDS[board]['pin_max']
                if not 2 <= value <= upper:
                    raise ValueError(key + ': GPIO không hợp lệ cho board')
            output[key] = str(value)
        elif kind in ('string', 'address'):
            if not isinstance(value, str) or len(value) > min(int(field.get('maxLength', 64)), 128) or '\x00' in value:
                raise ValueError(key + ': chuỗi không hợp lệ')
            if kind == 'address' and not re.fullmatch(r'[a-zA-Z0-9 ._:/-]{1,128}', value):
                raise ValueError(key + ': địa chỉ chứa ký tự không cho phép')
            output[key] = json.dumps(value, ensure_ascii=True)
        elif kind == 'boolean':
            if type(value) is not bool:
                raise ValueError(key + ': cần true/false')
            output[key] = 'true' if value else 'false'
        elif kind == 'choice':
            options = field.get('options', [])
            if not isinstance(value, (str, int)) or value not in options:
                raise ValueError(key + ': không thuộc lựa chọn')
            output[key] = json.dumps(value, ensure_ascii=True) if isinstance(value, str) else str(value)
        else:
            raise ValueError(key + ': loại biến không hỗ trợ')
    if set(config) - allowed:
        raise ValueError('Phát hiện biến không được quản trị viên cho phép')
    return output


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--project', required=True)
    parser.add_argument('--board', required=True)
    parser.add_argument('--config-b64', required=True)
    parser.add_argument('--allow-draft', action='store_true')
    args = parser.parse_args()
    if not SLUG.fullmatch(args.project):
        raise ValueError('Project ID không hợp lệ')
    if len(args.config_b64) > 16000:
        raise ValueError('Cấu hình quá lớn')
    root = pathlib.Path(__file__).resolve().parents[1]
    template = root / 'projects' / args.project
    meta = json.loads((template / 'manifest.json').read_text('utf-8'))
    if (not meta.get('published') and not args.allow_draft) or meta.get('id') != args.project:
        raise ValueError('Chương trình không tồn tại hoặc chưa phát hành')
    libraries=meta.get('libraries', [])
    if not isinstance(libraries,list) or len(libraries)>16 or any(not isinstance(lib,str) or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9 _.-]{0,69}',lib) for lib in libraries):
        raise ValueError('Thư viện không hợp lệ')
    config = json.loads(base64.b64decode(args.config_b64, validate=True).decode('utf-8'))
    if not isinstance(config, dict):
        raise ValueError('Cấu hình phải là JSON object')
    substitutions = validate_fields(meta, args.board, config)
    sketch_dir = root / 'build' / 'AppDockSketch'
    sketch_dir.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(template / 'AppDockSketch.ino', sketch_dir / 'AppDockSketch.ino')
    (sketch_dir / 'generated_config.h').write_text(
        '#pragma once\n' + ''.join(f'#define {key} {value}\n' for key, value in substitutions.items()), encoding='utf-8'
    )
    item = BOARDS[args.board]
    fqbn, core, url = item['fqbn'], item['core'], item['additional_url']
    (root / 'build' / 'selection.json').write_text(json.dumps({
        'project_id': args.project, 'board': args.board, 'fqbn': fqbn, 'core': core,
        'additional_url': url, 'libraries': libraries, 'template_version': meta.get('version', '1.0.0')
    }), encoding='utf-8')
    print(f'Prepared {args.project} for {fqbn}; {len(substitutions)} admin-approved variables')

if __name__ == '__main__':
    main()
