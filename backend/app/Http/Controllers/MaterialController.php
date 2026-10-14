<?php

namespace App\Http\Controllers;

use App\Models\Material;
use App\Models\Category;
use App\Models\Location;
use App\Models\Unit;
use App\Services\StockManagementService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Illuminate\Http\RedirectResponse;

class MaterialController extends Controller
{
    public function index(Request $request): Response
    {
        $query = Material::with(['category', 'location', 'unit']);

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('sku', 'like', "%{$search}%");
            });
        }

        $materials = $query->orderBy('created_at', 'desc')->paginate(15)->withQueryString();

        return Inertia::render('Materials/Index', [
            'materials' => $materials,
            'filters' => $request->only(['search']),
            'categories' => Category::where('type', 'material')->get(['id', 'name']),
            'locations' => Location::all(['id', 'name']),
            'units' => Unit::all(['id', 'name']),
        ]);
    }

    public function recordTransaction(Request $request, Material $material, StockManagementService $service): RedirectResponse
    {
        $validated = $request->validate([
            'type' => ['required', 'in:IN,OUT,ADJUST'],
            'quantity' => ['required', 'integer', 'min:1'],
            'unit_price' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        $service->recordTransaction(
            $material,
            $validated['type'],
            $validated['quantity'],
            (string)($validated['unit_price'] ?? $material->unit_price),
            $request->user(),
            $validated['notes'] ?? null
        );

        return redirect()->route('materials.index')->with('success', 'บันทึกรายการเบิก-จ่ายพัสดุสำเร็จ');
    }
}
