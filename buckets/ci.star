load(
  '//lib/builders.star',
  'builder',
  'defaults',
  'dimensions',
  'config_section',
  'builder_descriptor',
  'generate_ci_configs',
)

defaults.build_numbers.set(True)

generate_ci_configs(
    configurations = [
      config_section(
        name="ci",
        branch='refs/heads/master',
        view='Main',
        name_suffix='',
        notifiers=['devtools tree closer'],
      ),
      config_section(
        name="chromium",
        repo='https://chromium.googlesource.com/chromium/src',
        branch='refs/heads/master',
        name_suffix = ' (chromium)',
        mastername="chromium.devtools-frontend",
        notifiers=['devtools tree closer'],
      ),
      config_section(
        name="beta",
        branch='refs/heads/chromium/4183',
        notifiers=['devtools notifier'],
      ),
      config_section(
        name="stable",
        branch='refs/heads/chromium/4147',
        notifiers=['devtools notifier'],
      ),
      config_section(
        name="previous",
        branch='refs/heads/chromium/4103',
        notifiers=['devtools notifier'],
      ),
    ],
    builders = [
      builder_descriptor(
        name='DevTools Linux',
        recipe_name='chromium_integration',
        excluded_from=['beta', 'stable', 'previous']
      ),
      builder_descriptor(
        name="Stand-alone Linux",
        recipe_name="devtools/devtools-frontend",
        excluded_from=['chromium']
      ),
      builder_descriptor(
        name="Backend Linux",
        recipe_name="devtools/devtools-backend",
        excluded_from=['chromium'],
        notification_muted=True,
      ),
    ]
)

builder(
    name="Auto-roll - devtools deps",
    bucket="ci",
    mastername="client.devtools-frontend.integration",
    service_account='devtools-ci-autoroll-builder@chops-service-accounts.iam.gserviceaccount.com',
    schedule="0 3,12 * * *",
    recipe_name="v8/auto_roll_v8_deps",
    dimensions=dimensions.default_ubuntu,
    execution_timeout=2 * time.hour
)

builder(
    name="Auto-roll - devtools chromium",
    bucket="ci",
    mastername="client.devtools-frontend.integration",
    service_account='devtools-ci-autoroll-builder@chops-service-accounts.iam.gserviceaccount.com',
    schedule="0 6 * * *",
    recipe_name="v8/auto_roll_v8_deps",
    dimensions=dimensions.default_ubuntu,
    execution_timeout=2 * time.hour
)

luci.list_view(
    name="infra",
    title="Infra",
    favicon=defaults.favicon,
    entries=[
      luci.list_view_entry(builder="Auto-roll - devtools chromium"),
      luci.list_view_entry(builder="Auto-roll - devtools deps"),
    ],
)
