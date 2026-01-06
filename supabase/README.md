# Supabase Migrations

## Setup Instructions

To set up all tables in your Supabase database:

1. **Open your Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project

2. **Navigate to SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New query"

3. **Run the Migrations in Order**
   - Run `migrations/001_create_ads_table.sql` first (includes RLS for ads table)
   - Then run `migrations/002_create_ad_configurations_table.sql` (includes RLS for ad_configurations table)
   - Finally run `migrations/003_create_ad_preload_settings_table.sql` (includes RLS for ad_preload_settings table)
   - For each migration: Copy the contents, paste into SQL Editor, and click "Run" (or press `Ctrl+Enter` / `Cmd+Enter`)

4. **Verify the Tables**
   - Go to "Table Editor" in the left sidebar
   - You should see:
     - `ads` table with 50 sample records
     - `ad_configurations` table with default ad unit IDs
     - `ad_preload_settings` table with default preload settings

## Table Schemas

### 1. `ads` Table
Content ads table for displaying ad listings in the app.

- `id` (UUID) - Primary key
- `title` (VARCHAR) - Ad title
- `description` (TEXT) - Ad description
- `ad_type` (VARCHAR) - Type of ad (banner, video, interstitial, rewarded, native, app_open)
- `status` (VARCHAR) - Status (active, paused)
- `impressions` (INTEGER) - Number of impressions
- `clicks` (INTEGER) - Number of clicks
- `revenue` (DECIMAL) - Revenue generated
- `created_at` (TIMESTAMP) - Creation timestamp
- `updated_at` (TIMESTAMP) - Last update timestamp

### 2. `ad_configurations` Table
Stores ad unit IDs for different ad types and screens. This allows you to manage all ad IDs from Supabase without code changes.

- `id` (UUID) - Primary key
- `screen_name` (VARCHAR) - Screen name (e.g., 'home', 'detail', 'onboarding', 'global')
- `ad_type` (VARCHAR) - Ad type (e.g., 'app_open', 'interstitial', 'rewarded', 'native', 'banner')
- `ad_unit_id` (VARCHAR) - Google AdMob ad unit ID
- `is_active` (BOOLEAN) - Whether this configuration is active
- `created_at` (TIMESTAMP) - Creation timestamp
- `updated_at` (TIMESTAMP) - Last update timestamp
- **Unique constraint**: `(screen_name, ad_type)`

**Default Configurations:**
- Global: app_open, interstitial, rewarded, rewarded_interstitial
- Home screen: native, banner
- Detail screen: native
- Onboarding screen: banner, native

### 3. `ad_preload_settings` Table
Stores preloading settings for different screens and ad types. This allows you to manage ad preloading behavior from Supabase.

- `id` (UUID) - Primary key
- `screen_name` (VARCHAR) - Screen name
- `ad_type` (VARCHAR) - Ad type
- `pool_size` (INTEGER) - Number of ads to keep in pool
- `min_pool_size` (INTEGER) - Minimum pool size before refill
- `ad_frequency` (INTEGER) - Show ad after every N items
- `preload_distance` (INTEGER) - Load ad when within N items of next ad position
- `dispose_distance` (INTEGER) - Dispose ad when scrolled N+ items past it
- `counter_threshold` (INTEGER) - For interstitial ads: show ad after N interactions
- `is_active` (BOOLEAN) - Whether this setting is active
- `created_at` (TIMESTAMP) - Creation timestamp
- `updated_at` (TIMESTAMP) - Last update timestamp
- **Unique constraint**: `(screen_name, ad_type)`

**Default Settings:**
- Home screen native: poolSize=4, minPoolSize=4, adFrequency=2, preloadDistance=2, disposeDistance=4
- Detail screen native: poolSize=3, minPoolSize=3, adFrequency=1, preloadDistance=1, disposeDistance=10
- Global interstitial: counterThreshold=2

## Managing Ad Configurations

### Updating Ad Unit IDs
1. Go to Supabase Table Editor
2. Open `ad_configurations` table
3. Find the row for the screen and ad type you want to update
4. Edit the `ad_unit_id` field
5. Save changes

The app will automatically use the new ad unit ID on next initialization (app restart or screen navigation).

### Updating Preload Settings
1. Go to Supabase Table Editor
2. Open `ad_preload_settings` table
3. Find the row for the screen and ad type you want to update
4. Edit the settings (pool_size, ad_frequency, etc.)
5. Save changes

The app will use the new settings on next screen initialization.

### Adding New Screen Configurations
1. Insert a new row in `ad_configurations` with:
   - `screen_name`: Your screen name
   - `ad_type`: The ad type (native, banner, etc.)
   - `ad_unit_id`: Your AdMob ad unit ID
   - `is_active`: true

2. Optionally, insert a row in `ad_preload_settings` with custom preload settings

## Code Integration

The app automatically fetches configurations from Supabase using the `adConfigService`:

- `getAdUnitId(screenName, adType)` - Fetches ad unit ID for a screen/type
- `getPreloadSettings(screenName, adType)` - Fetches preload settings
- `getInterstitialCounterThreshold()` - Fetches interstitial counter threshold

All functions fall back to test IDs in development mode and default settings if Supabase is unavailable.

## Row Level Security (RLS)

All tables have Row Level Security enabled with the following policies:

### Public Access (SELECT)
- **All users** (including unauthenticated) can **view** all data from:
  - `ads` table
  - `ad_configurations` table
  - `ad_preload_settings` table

### Admin Access (INSERT, UPDATE, DELETE)
- **Only authenticated users with admin role** can:
  - Insert new records
  - Update existing records
  - Delete records

### Setting Up Admin Users

There are two ways to set up admin users:

#### Option 1: Using User Metadata (Default)
Set the user's role in their metadata:

```sql
-- Set a user as admin
UPDATE auth.users 
SET raw_user_meta_data = jsonb_build_object('role', 'admin') 
WHERE id = 'user-uuid-here';
```

#### Option 2: Using Admins Table (Alternative)
Uncomment the admins table code in `004_enable_rls_and_policies.sql` and use:

```sql
-- Add a user as admin
INSERT INTO admins (id) VALUES ('user-uuid-here');
```

### Testing RLS Policies

1. **Test Public Access:**
   - Use an unauthenticated/anonymous connection
   - Should be able to SELECT from all tables
   - Should NOT be able to INSERT/UPDATE/DELETE

2. **Test Admin Access:**
   - Authenticate as a user with admin role
   - Should be able to SELECT, INSERT, UPDATE, DELETE

3. **Test Non-Admin User:**
   - Authenticate as a regular user (without admin role)
   - Should be able to SELECT only
   - Should NOT be able to INSERT/UPDATE/DELETE

