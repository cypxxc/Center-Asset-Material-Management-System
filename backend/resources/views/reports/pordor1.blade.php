<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <title>แบบ พด. 1 — ทะเบียนคุมทรัพย์สิน ({{ $asset->asset_code }})</title>
    <style>
        body {
            font-family: 'Sarabun', 'TH Sarabun New', sans-serif;
            font-size: 14pt;
            color: #1a1a1a;
            margin: 0;
            padding: 0;
        }
        .header {
            text-align: center;
            font-weight: bold;
            font-size: 18pt;
            margin-bottom: 20px;
        }
        .meta-table, .data-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
        }
        .meta-table td {
            padding: 4px 8px;
        }
        .data-table th, .data-table td {
            border: 1px solid #333;
            padding: 6px 8px;
            text-align: center;
        }
        .data-table th {
            background-color: #f2f2f2;
            font-weight: bold;
        }
        .text-left { text-align: left; }
        .text-right { text-align: right; }
    </style>
</head>
<body>
    <div class="header">ทะเบียนคุมทรัพย์สิน (แบบ พด. 1)</div>

    <table class="meta-table">
        <tr>
            <td width="50%"><strong>รหัสครุภัณฑ์:</strong> {{ $asset->asset_code }}</td>
            <td width="50%"><strong>ประเภท:</strong> {{ $asset->category->name ?? '-' }}</td>
        </tr>
        <tr>
            <td><strong>ชื่อครุภัณฑ์:</strong> {{ $asset->name }}</td>
            <td><strong>สถานที่ตั้ง:</strong> {{ $asset->location->name ?? '-' }}</td>
        </tr>
        <tr>
            <td><strong>หมายเลขเครื่อง (Serial No.):</strong> {{ $asset->serial_number ?? '-' }}</td>
            <td><strong>วันที่ได้มา:</strong> {{ \Carbon\Carbon::parse($asset->acquisition_date)->addYears(543)->format('d/m/Y') }}</td>
        </tr>
        <tr>
            <td><strong>ราคาทุน:</strong> {{ number_format($asset->cost, 2) }} บาท</td>
            <td><strong>อายุการใช้งาน:</strong> {{ $asset->useful_life_years }} ปี</td>
        </tr>
    </table>

    <table class="data-table">
        <thead>
            <tr>
                <th>ปีงบประมาณ</th>
                <th>ค่าเสื่อมราคาประจำปี (บาท)</th>
                <th>ค่าเสื่อมราคาสะสม (บาท)</th>
                <th>มูลค่าสุทธิ (Net Book Value)</th>
            </tr>
        </thead>
        <tbody>
            @forelse($depreciationRecords as $record)
                <tr>
                    <td>{{ $record->fiscal_year }}</td>
                    <td class="text-right">{{ number_format($record->annual_depreciation, 2) }}</td>
                    <td class="text-right">{{ number_format($record->accumulated_depreciation, 2) }}</td>
                    <td class="text-right">{{ number_format($record->net_book_value, 2) }}</td>
                </tr>
            @empty
                <tr>
                    <td colspan="4">ยังไม่มีประวัติการคำนวณค่าเสื่อมราคา</td>
                </tr>
            @endforelse
        </tbody>
    </table>
</body>
</html>
