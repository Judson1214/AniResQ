import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, Mail, Phone, Shield, Camera } from "lucide-react";
import { useState } from "react";
import { updateUserProfile } from "@/services/auth.service";
import { useToast } from "@/components/ui/use-toast";
import { useAuthStore } from "@/store/authStore";
const ProfilePage = () => {
  const { user } = useAuth();
  const { setUser } = useAuthStore();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.displayName || "",
    phone: user?.phone || ""
  });
  if (!user) return null;
  const getInitials = (name) => {
    if (!name) return "";
    return name.substring(0, 2).toUpperCase();
  };
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateUserProfile(user.uid, {
        displayName: formData.name,
        phone: formData.phone
      });
      setUser({ ...user, displayName: formData.name, phone: formData.phone });
      setIsEditing(false);
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully."
      });
    } catch (error) {
      toast({
        title: "Error updating profile",
        description: error.message || "Something went wrong.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };
  return <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Profile</h1>
          <p className="text-gray-500">Manage your account settings and preferences.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-1">
            <CardContent className="pt-6 flex flex-col items-center">
              <div className="relative mb-4">
                <Avatar className="w-32 h-32">
                  <AvatarImage src={user.avatarUrl} alt={user.displayName} />
                  <AvatarFallback className="text-3xl bg-emerald-100 text-emerald-700">
                    {getInitials(user.displayName)}
                  </AvatarFallback>
                </Avatar>
                <button className="absolute bottom-0 right-0 p-2 bg-emerald-600 rounded-full text-white hover:bg-emerald-700 transition-colors">
                  <Camera className="w-4 h-4" />
                </button>
              </div>
              <h3 className="font-semibold text-xl text-center">{user.displayName}</h3>
              <div className="flex items-center gap-1.5 mt-1 text-sm text-gray-500 capitalize bg-gray-100 px-3 py-1 rounded-full">
                <Shield className="w-3.5 h-3.5" />
                {user.role.toLowerCase()}
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Personal Information</CardTitle>
                  <CardDescription>Update your personal details here.</CardDescription>
                </div>
                {!isEditing ? <Button variant="outline" onClick={() => setIsEditing(true)}>
                    Edit Profile
                  </Button> : <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => setIsEditing(false)} disabled={isSaving}>
                      Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700">
                      {isSaving ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-500" /> Full Name
                  </Label>
                  <Input
    id="name"
    value={formData.name}
    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
    disabled={!isEditing}
    className="max-w-md"
  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-gray-500" /> Email Address
                  </Label>
                  <Input
    id="email"
    value={user.email}
    disabled={true}
    className="max-w-md bg-gray-50 text-gray-500"
  />
                  <p className="text-xs text-gray-500">Email cannot be changed.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-gray-500" /> Phone Number
                  </Label>
                  <Input
    id="phone"
    value={formData.phone}
    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
    disabled={!isEditing}
    className="max-w-md"
    placeholder="Add a phone number"
  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>;
};
var stdin_default = ProfilePage;
export {
  stdin_default as default
};
