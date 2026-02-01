import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';

export class NotificationTool {
    static async notify(title: string, body: string): Promise<string> {
        try {
            let permissionGranted = await isPermissionGranted();

            if (!permissionGranted) {
                const permission = await requestPermission();
                permissionGranted = permission === 'granted';
            }

            if (permissionGranted) {
                sendNotification({ title, body });
                return `Notification sent: ${title}`;
            } else {
                return 'Notification failed: Permission denied';
            }
        } catch (error) {
            console.error('Notification error:', error);
            return `Notification failed: ${error instanceof Error ? error.message : String(error)}`;
        }
    }
}
