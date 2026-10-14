<?php

namespace App\Http\Controllers;

use App\Models\Asset;
use App\Models\Category;
use App\Models\Location;
use App\Models\Unit;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Illuminate\Http\RedirectResponse;

class AssetController extends Controller
{
    public function index(Request $request): Response
    {
        $query = Asset::with(['category', 'location', 'unit']);

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('asset_code', 'like', "%{$search}%")
                  ->orWhere('serial_number', 'like', "%{$search}%");
            });
        }

        if ($request->filled('category_id')) {
            $query->where('category_id', $request->input('category_id'));
        }

        $assets = $query->orderBy('created_at', 'desc')->paginate(15)->withQueryString();

        return Inertia::render('Assets/Index', [
            'assets' => $assets,
            'filters' => $request->only(['search', 'category_id']),
            'categories' => Category::where('type', 'asset')->get(['id', 'name']),
            'locations' => Location::all(['id', 'name']),
            'units' => Unit::all(['id', 'name']),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'asset_code' => ['required', 'string', 'max:50'],
            'serial_number' => ['nullable', 'string', 'max:100'],
            'name' => ['required', 'string', 'max:255'],
            'category_id' => ['required', 'exists:categories,id'],
            'location_id' => ['required', 'exists:locations,id'],
            'unit_id' => ['required', 'exists:units,id'],
            'cost' => ['required', 'numeric', 'min:0'],
            'salvage_value' => ['nullable', 'numeric', 'min:1'],
            'useful_life_years' => ['required', 'integer', 'min:1', 'max:50'],
            'acquisition_date' => ['required', 'date'],
        ]);

        Asset::create($validated);

        return redirect()->route('assets.index')->with('success', 'บันทึกข้อมูลครุภัณฑ์สำเร็จ');
    }

    public function destroy(Asset $asset): RedirectResponse
    {
        $asset->delete(); // Soft delete per CAMMS rules

        return redirect()->route('assets.index')->with('success', 'ลบข้อมูลครุภัณฑ์สำเร็จ');
    }
}
