<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <title>Thermal QR Label</title>
    <style>
        @page {
            size: 50mm 30mm;
            margin: 0;
        }
        body {
            width: 50mm;
            height: 30mm;
            margin: 0;
            padding: 2mm;
            box-sizing: border-box;
            font-family: 'Sarabun', sans-serif;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .qr-box {
            width: 24mm;
            height: 24mm;
        }
        .qr-box svg {
            width: 100%;
            height: 100%;
        }
        .info-box {
            width: 22mm;
            font-size: 7pt;
            line-height: 1.1;
            overflow: hidden;
        }
        .org-title {
            font-weight: bold;
            font-size: 7.5pt;
            border-bottom: 0.5px solid #000;
            margin-bottom: 2px;
            padding-bottom: 1px;
        }
        .asset-code {
            font-weight: bold;
            font-size: 8pt;
            color: #000;
        }
    </style>
</head>
<body>
    <div class="qr-box">
        {!! $qr_svg !!}
    </div>
    <div class="info-box">
        <div class="org-title">{{ $org_name }}</div>
        <div class="asset-code">{{ $asset_code }}</div>
        <div>{{ Str::limit($name, 25) }}</div>
        <div>S/N: {{ $serial_number }}</div>
    </div>
</body>
</html>
