#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""单字手写/印刷体识别：输出 JSON { zi, confidence, raw }。
依赖：pip install -r scripts/requirements-paddle.txt
启用：环境变量 PADDLE_OCR_ENABLED=true，且服务器已安装 Python3 + PaddleOCR。
"""
import json
import re
import sys

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"zi": "", "confidence": 0, "error": "missing image path"}))
        sys.exit(2)
    path = sys.argv[1]
    try:
        from paddleocr import PaddleOCR  # noqa: PLC0415

        ocr = PaddleOCR(use_angle_cls=True, lang="ch", show_log=False)
        result = ocr.ocr(path, cls=True)
        texts = []
        if result and result[0]:
            for line in result[0]:
                if line and len(line) >= 2 and line[1]:
                    texts.append(str(line[1][0]))
        s = "".join(texts).strip()
        m = re.search(r"[\u4e00-\u9fa5]", s)
        zi = m.group(0) if m else ""
        conf = 0.9 if zi else 0.0
        print(json.dumps({"zi": zi, "confidence": conf, "raw": s[:80]}, ensure_ascii=False))
    except Exception as e:  # noqa: BLE001
        print(json.dumps({"zi": "", "confidence": 0, "error": str(e)}, ensure_ascii=False))
        sys.exit(1)


if __name__ == "__main__":
    main()
