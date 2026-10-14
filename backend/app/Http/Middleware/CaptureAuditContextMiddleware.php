<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Spatie\Activitylog\Facades\LogBatch;

class CaptureAuditContextMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        LogBatch::startBatch();

        $response = $next($request);

        LogBatch::endBatch();

        return $response;
    }
}
