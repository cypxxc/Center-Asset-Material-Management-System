<?php

namespace App\Services;

use Spatie\Browsershot\Browsershot;
use App\Models\Asset;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\View;

class PdfReportService
{
    protected string $chromePath;

    public function __construct()
    {
        $this->chromePath = env('CHROME_PATH', '/usr/bin/chromium');
    }

    /**
     * Generates Official Thai Form พด. 1 (ทะเบียนคุมทรัพย์สิน) PDF
     */
    public function generatePordor1Pdf(Asset $asset): string
    {
        $html = View::make('reports.pordor1', [
            'asset' => $asset,
            'depreciationRecords' => $asset->depreciationRecords()->orderBy('fiscal_year')->get(),
        ])->render();

        return Browsershot::html($html)
            ->setChromePath($this->chromePath)
            ->addChromiumArguments(['no-sandbox', 'disable-setuid-sandbox', 'disable-gpu'])
            ->format('A4')
            ->landscape()
            ->margins(10, 10, 10, 10)
            ->pdf();
    }

    /**
     * Generates Asset Inventory Summary Report PDF
     */
    public function generateInventorySummaryPdf(Collection $assets): string
    {
        $html = View::make('reports.inventory-summary', [
            'assets' => $assets,
            'generatedAt' => now()->addYears(543)->translatedFormat('d F Y H:i'),
        ])->render();

        return Browsershot::html($html)
            ->setChromePath($this->chromePath)
            ->addChromiumArguments(['no-sandbox', 'disable-setuid-sandbox'])
            ->format('A4')
            ->margins(12, 12, 12, 12)
            ->pdf();
    }
}
