#!/usr/bin/env python3
"""Build safe, board-specific flash offsets from the Arduino core's own output."""
import json
import pathlib
import re
import shlex
import shutil

ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'build' / 'output'
DEST = ROOT / 'build' / 'artifact'
CHIP = {'esp32':'ESP32','esp32_s2':'ESP32-S2','esp32_s3':'ESP32-S3',
        'esp32_c3':'ESP32-C3','esp32_c6':'ESP32-C6',
        'esp8266':'ESP8266','d1_mini':'ESP8266','nano_esp32':'ESP32-S3'}

def _flash_pairs(args,files):
    images=[]
    options={'flashMode':'keep','flashFreq':'keep','flashSize':'keep'}
    flags={'--flash-mode':'flashMode','--flash-freq':'flashFreq','--flash-size':'flashSize'}
    index=0
    while index<len(args):
        value=args[index]
        if value in flags and index+1<len(args):
            options[flags[value]]=args[index+1]; index+=2
        elif re.fullmatch(r'0x[0-9a-fA-F]+',value) and index+1<len(args) and args[index+1].endswith('.bin'):
            name=pathlib.PurePath(args[index+1]).name
            if name not in files:raise ValueError('Thiếu flash image: '+name)
            images.append({'file':name,'address':int(value,16)});index+=2
        else:index+=1
    return images,options

UF2_BOARDS={'pico','pico_w','pico2','pico2_w'}
AVR109_BOARDS={'leonardo','micro'}
UPDI_BOARDS={'nano_every','uno_wifi_rev2'}
DFU_BOARDS={'uno_r4_minima','uno_r4_wifi'}
SAMD_BOARDS={'nano_33_iot','mkr_wifi_1010'}
MBED_BOARDS={'nano_33_ble','nano_rp2040'}
DUE_BOARDS={'due_programming','due_native'}
CLASSIC_AVR={'uno','nano','nano_old','rf_nano','rf_nano_old','mega','pro_mini'}

def build_non_esp_manifest(board,files):
    types={'avr':('.hex',),'avr109':('.hex',),'jtag2updi':('.hex',),
           'dfu':('.bin','.hex'),'bossac':('.bin',),'sam-ba':('.bin',),
           'mbed':('.bin','.uf2','.hex'),'uf2':('.uf2',)}
    if board in UF2_BOARDS: proto='uf2'
    elif board in AVR109_BOARDS: proto='avr109'
    elif board in UPDI_BOARDS: proto='jtag2updi'
    elif board in DFU_BOARDS: proto='dfu'
    elif board in SAMD_BOARDS: proto='bossac'
    elif board in MBED_BOARDS: proto='mbed'
    elif board in DUE_BOARDS: proto='sam-ba'
    elif board in CLASSIC_AVR: proto='avr'
    else: raise ValueError('Không có profile firmware cho '+board)
    output=sorted(name for name,p in files.items() if p.is_file() and
                  p.suffix.lower() in ('.hex','.bin','.uf2') and
                  not any(marker in name for marker in ('with_bootloader','bootloader.bin','partitions.bin')))
    good=[name for suffix in types[proto] for name in output if name.endswith(suffix)]
    if not good: raise ValueError('Không có firmware '+str(types[proto])+' phù hợp '+board)
    return {'schema':1,'board':board,'protocol':proto,'images':[],
            'preferred':good[0],
            'files':[{'name':name,'size':files[name].stat().st_size} for name in output]}

def build_manifest(selection,files):
    board=selection['board']
    found={p.name:p for p in files if p.is_file()}
    if board not in CHIP:
        return build_non_esp_manifest(board,found)
    options={'flashMode':'keep','flashFreq':'keep','flashSize':'keep'}
    if board in ('esp8266','d1_mini'):
        images=[n for n in found if n.endswith('.bin') and not any(x in n for x in ('.merged.','.bootloader.','.partitions.','boot_app0'))]
        if len(images)!=1:raise ValueError('ESP8266 cần một ứng dụng .bin')
        selected=[{'file':images[0],'address':0}]
    else:
        selected=[]
        if 'flash_args' in found:
            selected,options=_flash_pairs(shlex.split(found['flash_args'].read_text('utf-8')),found)
        if not selected:
            merged=[n for n in found if n.endswith('.merged.bin')]
            if len(merged)==1:selected=[{'file':merged[0],'address':0}]
        if not selected:
            boot=[n for n in found if n.endswith('.bootloader.bin')]
            part=[n for n in found if n.endswith('.partitions.bin')]
            app=[n for n in found if n.endswith('.bin') and not any(x in n for x in ('.merged.','.bootloader.','.partitions.','boot_app0'))]
            if len(boot)==len(part)==len(app)==1:
                address=0x1000 if board=='esp32' else 0
                selected=[{'file':boot[0],'address':address},{'file':part[0],'address':0x8000},{'file':app[0],'address':0x10000}]
                if 'boot_app0.bin' in found:selected.insert(2,{'file':'boot_app0.bin','address':0xe000})
        if not selected:raise ValueError('ESP32 thiếu bootloader/partitions/merged.bin: không tạo firmware không đầy đủ')
    intervals=[]
    for image in selected:
        p=found[image['file']]
        address=image['address'];size=p.stat().st_size
        if size<1 or size>16*1024*1024 or address%4096:raise ValueError('Flash image/offset không hợp lệ')
        end=address+((size+4095)//4096)*4096
        if end>16*1024*1024:raise ValueError('Firmware vượt giới hạn flash 16MB')
        if any(not (end<=a or address>=b) for a,b in intervals):raise ValueError('Phân vùng flash trùng nhau')
        intervals.append((address,end));image['size']=size
    return {'schema':1,'board':board,'protocol':'esptool','chip':CHIP[board],'options':options,'images':selected}

def main():
    selection=json.loads((ROOT/'build'/'selection.json').read_text('utf-8'))
    DEST.mkdir(parents=True,exist_ok=True)
    files=list(SOURCE.iterdir())
    manifest=build_manifest(selection,files)
    image_names={x['file'] for x in manifest['images']}
    for image in manifest['images']:shutil.copy2(SOURCE/image['file'],DEST/image['file'])
    for source in files:
        if not source.is_file():continue
        if source.suffix.lower() in ('.hex','.uf2') and 'with_bootloader' not in source.name:
            shutil.copy2(source,DEST/source.name)
        if source.suffix.lower()=='.bin' and source.name not in image_names:
            shutil.copy2(source,DEST/source.name)
    (DEST/'flash-manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    (DEST/'build-info.json').write_text(json.dumps(selection,indent=2),encoding='utf-8')
    if manifest['protocol']!='esptool' and (not manifest.get('preferred') or not (DEST/manifest['preferred']).is_file()):
        raise ValueError('Thiếu firmware chính dành cho '+selection['board'])
    print('Packed',selection['board'],manifest['protocol'],len(manifest['images']),'images')
if __name__=='__main__':main()
