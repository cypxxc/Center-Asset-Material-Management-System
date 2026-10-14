<?php

return [
    'default' => env('DB_CONNECTION', 'pgsql'),

    'connections' => [
        'pgsql' => [
            'driver' => 'pgsql',
            'url' => env('DB_URL'),
            'host' => env('DB_HOST', '127.0.0.1'),
            'port' => env('DB_PORT', '5432'),
            'database' => env('DB_DATABASE', 'camms'),
            'username' => env('DB_USERNAME', 'camms_user'),
            'password' => env('DB_PASSWORD', 'camms_password'),
            'charset' => env('DB_CHARSET', 'utf8'),
            'prefix' => '',
            'prefix_indexes' => true,
            'search_path' => 'public',
            'sslmode' => 'prefer',
        ],

        'pgsql_legacy' => [
            'driver' => 'pgsql',
            'url' => env('LEGACY_DB_URL'),
            'host' => env('LEGACY_DB_HOST', '127.0.0.1'),
            'port' => env('LEGACY_DB_PORT', '5432'),
            'database' => env('LEGACY_DB_DATABASE', 'camms_legacy'),
            'username' => env('LEGACY_DB_USERNAME', 'postgres'),
            'password' => env('LEGACY_DB_PASSWORD', ''),
            'charset' => 'utf8',
            'prefix' => '',
            'search_path' => 'public',
            'sslmode' => 'prefer',
        ],
    ],

    'migrations' => [
        'table' => 'migrations',
        'update_date_on_publish' => true,
    ],
];
