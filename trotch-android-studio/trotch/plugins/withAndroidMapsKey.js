/**
 * Android Google Maps key, resolved when Gradle builds (Android Studio or `expo run:android`),
 * not frozen into AndroidManifest.xml at prebuild time.
 *
 * Why: react-native-maps' plugin drops the com.google.android.geo.API_KEY meta-data entirely
 * when the key is empty, and Google Maps then crashes the app ("API key not found") as soon as
 * a map screen opens. Here the manifest always carries the entry, filled from the
 * ${googleMapsApiKey} placeholder, so a missing key gives a blank map instead of a crash, and
 * you can add the key in Android Studio without regenerating the native project.
 *
 * Gradle looks for GOOGLE_MAPS_ANDROID_API_KEY, in order:
 *   1. a Gradle property (android/gradle.properties or -P on the command line)
 *   2. android/local.properties
 *   3. an environment variable
 *   4. the project's .env file
 */
const { withAndroidManifest, withAppBuildGradle } = require('@expo/config-plugins');
const { getMainApplicationOrThrow, addMetaDataItemToMainApplication } = require('@expo/config-plugins/build/android/Manifest');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');

const RESOLVER = `
// Resolves the Google Maps Android key (see plugins/withAndroidMapsKey.js).
def trotchMapsKey = { ->
    def name = 'GOOGLE_MAPS_ANDROID_API_KEY'
    def fromProp = findProperty(name)
    if (fromProp?.toString()?.trim()) return fromProp.toString().trim()
    def localProps = rootProject.file('local.properties')
    if (localProps.exists()) {
        def p = new Properties()
        localProps.withInputStream { p.load(it) }
        if (p.getProperty(name)?.trim()) return p.getProperty(name).trim()
    }
    def fromEnv = System.getenv(name)
    if (fromEnv?.trim()) return fromEnv.trim()
    def dotEnv = new File(projectRoot, '.env')
    if (dotEnv.exists()) {
        def line = dotEnv.readLines().find { it.trim().startsWith(name + '=') }
        if (line) {
            def v = line.substring(line.indexOf('=') + 1).trim().replaceAll(/^["']|["']$/, '')
            if (v) return v
        }
    }
    logger.warn("Trotch: \${name} is not set, so maps will be blank. Add it to .env or android/local.properties.")
    return ''
}
`;

module.exports = function withAndroidMapsKey(config) {
  config = withAndroidManifest(config, (conf) => {
    const app = getMainApplicationOrThrow(conf.modResults);
    addMetaDataItemToMainApplication(app, 'com.google.android.geo.API_KEY', '${googleMapsApiKey}');
    return conf;
  });

  config = withAppBuildGradle(config, (conf) => {
    let src = conf.modResults.contents;
    src = mergeContents({
      tag: 'trotch-maps-key-resolver',
      src,
      newSrc: RESOLVER,
      anchor: /def projectRoot = .*/,
      offset: 1,
      comment: '//',
    }).contents;
    src = mergeContents({
      tag: 'trotch-maps-key-placeholder',
      src,
      newSrc: "        manifestPlaceholders['googleMapsApiKey'] = trotchMapsKey()",
      anchor: /defaultConfig\s*\{/,
      offset: 1,
      comment: '//',
    }).contents;
    conf.modResults.contents = src;
    return conf;
  });

  return config;
};
