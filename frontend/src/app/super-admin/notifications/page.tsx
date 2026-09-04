import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Send, Bell } from "lucide-react";

export default function NotificationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-heading-sm font-semibold tracking-heading-sm">Notifications</h1>
        <p className="text-muted-foreground">Send platform-wide notifications.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Send Notification</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea
              placeholder="Type your notification message here..."
              rows={4}
            />
          </div>
          <div className="flex gap-2">
            <Button>
              <Send className="mr-2 h-4 w-4" /> Send to All
            </Button>
            <Button variant="outline">
              <Bell className="mr-2 h-4 w-4" /> Schedule
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}