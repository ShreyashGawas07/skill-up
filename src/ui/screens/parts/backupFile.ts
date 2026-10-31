import { Capacitor } from '@capacitor/core'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { format } from 'date-fns'

export const backupFileName = (now: number): string => `skillup-backup-${format(now, 'yyyy-MM-dd')}.json`

/**
 * Hands a backup JSON to the user. Native: written to the cache dir and passed to the share sheet
 * (cancelling the sheet is not an error). Web: downloaded via a temporary <a download>.
 */
export async function saveBackupFile(name: string, json: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const { uri } = await Filesystem.writeFile({ path: name, data: json, directory: Directory.Cache, encoding: Encoding.UTF8 })
    try {
      await Share.share({ title: 'SkillUp backup', url: uri, dialogTitle: 'Save backup' })
    } catch (e) {
      if (!/cancel/i.test(String((e as Error)?.message ?? e))) throw e
    }
    return
  }
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
