<?php

namespace App\Services;

use App\Models\Asset;
use SimpleSoftwareIO\QrCode\Facades\QrCode;

class QrTagGeneratorService
{
    /**
     * Generates a raw SVG QR code containing the asset inspection URL.
     */
    public function generateSvgQrCode(Asset $asset, int $size = 150): string
    {
        $inspectionUrl = route('audit.scan', ['asset_code' => $asset->asset_code]);

        return QrCode::size($size)
            ->format('svg')
            ->margin(1)
            ->generate($inspectionUrl);
    }

    /**
     * Prepares data array for Thermal 50mm x 30mm label printing.
     */
    public function prepareThermalLabelData(Asset $asset): array
    {
        return [
            'asset_code' => $asset->asset_code,
            'name' => $asset->name,
            'serial_number' => $asset->serial_number ?? '-',
            'qr_svg' => $this->generateSvgQrCode($asset, 120),
            'org_name' => config('app.name', 'CAMMS Portal'),
        ];
    }
}
