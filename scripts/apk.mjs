// Cross-platform `gradlew assembleDebug` for `npm run apk` (npm on Windows runs scripts via cmd.exe,
// where `./gradlew` does not work). Falls back to Android Studio's bundled JDK when JAVA_HOME is unset.
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const android = join(dirname(fileURLToPath(import.meta.url)), '..', 'android')
const win = process.platform === 'win32'
const env = { ...process.env }

if (!env.JAVA_HOME) {
  const candidates = win
    ? ['C:\\Program Files\\Android\\Android Studio\\jbr']
    : ['/Applications/Android Studio.app/Contents/jbr/Contents/Home', '/opt/android-studio/jbr']
  const jbr = candidates.find((p) => existsSync(p))
  if (jbr) {
    env.JAVA_HOME = jbr
    console.log(`JAVA_HOME not set; using ${jbr}`)
  }
}

// Absolute path: cmd.exe may not search the cwd for executables (NoDefaultCurrentDirectoryInExePath).
const gradlew = join(android, win ? 'gradlew.bat' : 'gradlew')
const r = spawnSync(win ? `"${gradlew}"` : gradlew, ['assembleDebug'], { cwd: android, env, stdio: 'inherit', shell: win })
if (r.status === 0) console.log(`\nAPK: ${join(android, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk')}`)
process.exit(r.status ?? 1)
