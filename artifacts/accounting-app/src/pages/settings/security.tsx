import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { Shield, Key, Fingerprint } from "lucide-react";

export default function SecuritySettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [fingerprintEnabled, setFingerprintEnabled] = useState(false);

  const handlePasswordUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simulate API request
    setTimeout(() => {
      setLoading(false);
      toast({
        title: "Password Updated",
        description: "Your password has been changed successfully.",
      });
      // Clear form (in a real app you'd reset state here)
      (e.target as HTMLFormElement).reset();
    }, 1000);
  };

  const toggleFingerprint = (checked: boolean) => {
    setFingerprintEnabled(checked);
    toast({
      title: checked ? "Biometric Authentication Enabled" : "Biometric Authentication Disabled",
      description: checked ? "You can now use fingerprint to login." : "Fingerprint login disabled.",
    });
  };

  return (
    <div className="container mx-auto py-8 max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Security Settings</h1>
          <p className="text-muted-foreground mt-1">
            Manage your password, 2FA, and biometric preferences.
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5 text-primary" />
                Change Password
              </CardTitle>
              <CardDescription>
                Update your password to keep your account secure.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handlePasswordUpdate}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current-password">Current Password</Label>
                  <Input id="current-password" type="password" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input id="new-password" type="password" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <Input id="confirm-password" type="password" required />
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={loading}>
                  {loading ? "Updating..." : "Update Password"}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Fingerprint className="h-5 w-5 text-primary" />
                Biometric Login
              </CardTitle>
              <CardDescription>
                Use Touch ID or Fingerprint on supported devices.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Enable Biometrics</Label>
                  <p className="text-sm text-muted-foreground">
                    For faster, secure logins.
                  </p>
                </div>
                <Switch 
                  checked={fingerprintEnabled}
                  onCheckedChange={toggleFingerprint}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-destructive/10 border-destructive/20">
            <CardHeader>
              <CardTitle className="text-destructive text-lg">Danger Zone</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Sign out from all devices or request an account deletion.
              </p>
              <Button variant="destructive" className="w-full">
                Sign Out Everywhere
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
