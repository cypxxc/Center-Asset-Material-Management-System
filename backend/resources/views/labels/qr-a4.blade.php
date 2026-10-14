<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <title>A4 QR Sheet (3x8 Stickers)</title>
    <style>
        @page {
            size: A4 portrait;
            margin: 10mm;
        }
        body {
            font-family: 'Sarabun', sans-serif;
            margin: 0;
            padding: 0;
        }
        .grid {
            display: grid;
            grid-template-columns: repeat(3, 63.5mm);
            grid-auto-rows: 33.9mm;
            gap: 2mm 3mm;
            justify-content: center;
        }
        .sticker {
            border: 0.5px dashed #ccc;
            padding: 2mm;
            box-sizing: border-box;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .qr-area {
            width: 25mm;
            height: 25mm;
        }
        .qr-area svg {
            width: 100%;
            height: 100%;
        }
        .desc-area {
            width: 33mm;
            font-size: 8pt;
            line-height: 1.2;
        }
        .code {
            font-weight: bold;
            font-size: 8.5pt;
        }
    </style>
</head>
<body>
    <div class="grid">
        @foreach($stickers as $item)
            <div class="sticker">
                <div class="qr-area">
                    {!! $item['qr_svg'] !!}
                </div>
                <div class="desc-area">
                    <div class="code">{{ $item['asset_code'] }}</div>
                    <div>{{ Str::limit($item['name'], 28) }}</div>
                    <div>S/N: {{ $item['serial_number'] }}</div>
                </div>
            </div>
        @endforeach
    </div>
</body>
</html>
