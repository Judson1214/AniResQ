import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  User, 
  Mail, 
  Phone, 
  Shield, 
  Camera, 
  Clock, 
  ShieldCheck, 
  CheckCircle2, 
  Loader2,
  MapPin,
  BellRing,
  Navigation,
  Info
} from "lucide-react";
import { updateUserProfile } from "@/services/auth.service";
import { requestClearance, withdrawClearance } from "@/services/user.service";
import { uploadIdDocument } from "@/services/storage.service";
import { useToast } from "@/components/ui/use-toast";
import { useAuthStore } from "@/store/authStore";

const ALLOWED_REQUESTED_ROLES = [
  { value: "VOLUNTEER", label: "Field Rescue Responder", description: "Receive emergency dispatch alerts and assist on-site." },
  { value: "SHELTER", label: "Animal Shelter / Sanctuary", description: "Admit surrendered animals, conduct intake health reviews, and manage adoptions." },
  { value: "NGO", label: "Welfare Organization (NGO)", description: "Coordinate rescue dispatches and organize community operations." },
  { value: "VET", label: "Licensed Veterinary Clinic", description: "Provide medical care, health status updates, and emergency triage." },
];

const RADIUS_OPTIONS = [5, 10, 15, 25, 50];

const ProfilePage = () => {
  const { user } = useAuth();
  const { setUser } = useAuthStore();
  const { toast } = useToast();
  
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmittingRole, setIsSubmittingRole] = useState(false);
  const [isWithdrawingClearance, setIsWithdrawingClearance] = useState(false);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);

  const handleIdFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploadingDoc(true);
      const relativePath = await uploadIdDocument(file);
      setIdCardUrl(relativePath);
      toast({
        title: "ID Document Uploaded",
        description: "Document securely uploaded to private storage.",
      });
    } catch (err) {
      console.error("ID document upload failed:", err);
      toast({
        title: "Upload Failed",
        description: err.message || "Failed to upload ID document",
        variant: "destructive"
      });
    } finally {
      setIsUploadingDoc(false);
    }
  };
  const [selectedRole, setSelectedRole] = useState("VOLUNTEER");
  const [idCardType, setIdCardType] = useState("Government Photo ID");
  const [idCardNumber, setIdCardNumber] = useState("");
  const [idCardUrl, setIdCardUrl] = useState("");
  
  const [formData, setFormData] = useState({
    name: user?.displayName || "",
    phone: user?.phone || "",
  });

  // Responder alerts & spatial radius state
  const [alertsEnabled, setAlertsEnabled] = useState(user?.alertsEnabled ?? true);
  const [serviceRadiusKm, setServiceRadiusKm] = useState(user?.serviceRadiusKm || 15);
  const [location, setLocation] = useState({
    lat: user?.latitude ?? null,
    lon: user?.longitude ?? null,
  });
  const [isSavingAlerts, setIsSavingAlerts] = useState(false);
  const [isDetectingGps, setIsDetectingGps] = useState(false);

  if (!user) return null;

  const hasPendingRoleRequest = user.requestedRole && user.requestedRole !== user.role;
  const isResponder = ["VOLUNTEER", "NGO", "STAFF", "ADMIN"].includes(user.role);

  const getInitials = (name) => {
    if (!name) return "";
    return name.substring(0, 2).toUpperCase();
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateUserProfile(user.uid, {
        displayName: formData.name,
        phone: formData.phone,
      });
      setUser({ ...user, displayName: formData.name, phone: formData.phone });
      setIsEditing(false);
      toast({
        title: "Profile updated",
        description: "Your personal details have been updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Error updating profile",
        description: error.message || "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRoleRequest = async () => {
    if (!idCardNumber.trim()) {
      toast({
        title: "ID Number Required",
        description: "Please enter your ID, license, or registration number.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmittingRole(true);
    try {
      const updatedUser = await requestClearance({
        requestedRole: selectedRole,
        idCardType,
        idCardNumber: idCardNumber.trim(),
        idCardUrl: idCardUrl.trim() || undefined,
      });
      setUser({ ...user, requestedRole: updatedUser.requestedRole || selectedRole });
      toast({
        title: "Clearance Request Submitted",
        description: `Your request for ${selectedRole} clearance with ID verification is pending administrator review.`,
      });
    } catch (error) {
      toast({
        title: "Request Failed",
        description: error.response?.data?.detail || error.message || "Could not submit role request.",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingRole(false);
    }
  };

  const handleWithdrawClearance = async () => {
    setIsWithdrawingClearance(true);
    try {
      await withdrawClearance();
      setUser({ ...user, requestedRole: null });
      toast({
        title: "Clearance Request Withdrawn",
        description: "Your pending clearance verification request has been cancelled.",
      });
    } catch (error) {
      toast({
        title: "Withdrawal Failed",
        description: error.response?.data?.detail || error.message || "Could not withdraw clearance request.",
        variant: "destructive",
      });
    } finally {
      setIsWithdrawingClearance(false);
    }
  };

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: "Geolocation Unavailable", description: "Browser does not support GPS geolocation", variant: "destructive" });
      return;
    }
    setIsDetectingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(4));
        const lon = Number(pos.coords.longitude.toFixed(4));
        setLocation({ lat, lon });
        setIsDetectingGps(false);
        toast({ title: "Base Location Detected", description: `Coordinates set to ${lat}, ${lon}` });
      },
      (err) => {
        setIsDetectingGps(false);
        toast({ title: "GPS Error", description: err.message || "Failed to detect coordinates", variant: "destructive" });
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleSaveAlerts = async () => {
    setIsSavingAlerts(true);
    try {
      await updateUserProfile(user.uid, {
        latitude: location.lat,
        longitude: location.lon,
        serviceRadiusKm: Number(serviceRadiusKm),
        alertsEnabled: Boolean(alertsEnabled),
      });
      setUser({
        ...user,
        latitude: location.lat,
        longitude: location.lon,
        serviceRadiusKm: Number(serviceRadiusKm),
        alertsEnabled: Boolean(alertsEnabled),
      });
      toast({
        title: "Alert Settings Saved",
        description: "Your responder dispatch radius and base coordinates have been updated.",
      });
    } catch (err) {
      toast({
        title: "Save Failed",
        description: err.response?.data?.detail || err.message || "Failed to update alert preferences.",
        variant: "destructive",
      });
    } finally {
      setIsSavingAlerts(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Profile & Credentials</h1>
          <p className="text-slate-400">Manage your account details and organizational clearance levels.</p>
        </div>

        {/* PENDING ROLE CLEARANCE BANNER */}
        {hasPendingRoleRequest && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center gap-3.5 animate-in fade-in">
            <Clock className="w-5 h-5 text-amber-400 mt-0.5 sm:mt-0 shrink-0" />
            <div className="flex-1">
              <h4 className="text-sm font-bold text-amber-300">
                Clearance Request Pending Administrator Review
              </h4>
              <p className="text-xs text-amber-200/80 mt-1">
                You have requested upgrade to <span className="font-bold underline">{user.requestedRole}</span> clearance. 
                Our platform administrators are currently reviewing your credentials. You will receive an in-app notification once verified.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-xs shrink-0">
                PENDING
              </Badge>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isWithdrawingClearance}
                onClick={handleWithdrawClearance}
                className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 text-xs h-7 px-2.5"
              >
                {isWithdrawingClearance ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                Withdraw
              </Button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* USER CARD */}
          <Card className="md:col-span-1 border-slate-800 bg-[#0A0F1C] shadow-xl rounded-2xl">
            <CardContent className="pt-6 flex flex-col items-center">
              <div className="relative mb-4">
                <Avatar className="w-28 h-28 border-2 border-slate-700">
                  <AvatarImage src={user.avatarUrl} alt={user.displayName} />
                  <AvatarFallback className="text-2xl bg-emerald-950 text-emerald-400 font-bold">
                    {getInitials(user.displayName)}
                  </AvatarFallback>
                </Avatar>
                <button 
                  type="button"
                  aria-label="Change profile photo"
                  className="absolute bottom-0 right-0 p-2 bg-emerald-600 rounded-full text-white hover:bg-emerald-500 transition-colors shadow-md"
                >
                  <Camera className="w-4 h-4" />
                </button>
              </div>
              <h3 className="font-bold text-lg text-white text-center">{user.displayName || "User"}</h3>
              <div className="flex items-center gap-1.5 mt-1.5 text-xs text-slate-300 font-semibold capitalize bg-slate-800 border border-slate-700 px-3 py-1 rounded-full">
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                {user.role?.toLowerCase() || "citizen"}
              </div>
            </CardContent>
          </Card>

          {/* PERSONAL INFO CARD */}
          <Card className="md:col-span-2 border-slate-800 bg-[#0A0F1C] shadow-xl rounded-2xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold text-white">Personal Information</CardTitle>
                  <CardDescription className="text-xs text-slate-400">Update your verified contact details.</CardDescription>
                </div>
                {!isEditing ? (
                  <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="border-slate-700 text-slate-300 hover:bg-slate-800">
                    Edit Profile
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)} disabled={isSaving} className="text-slate-400">
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold">
                      {isSaving ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="flex items-center gap-2 text-xs text-slate-300">
                    <User className="w-3.5 h-3.5 text-slate-500" /> Full Name
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    disabled={!isEditing}
                    className="bg-slate-900 border-slate-800 text-white text-sm"
                  />
                </div>
                
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="flex items-center gap-2 text-xs text-slate-300">
                    <Mail className="w-3.5 h-3.5 text-slate-500" /> Email Address
                  </Label>
                  <Input
                    id="email"
                    value={user.email || ""}
                    disabled={true}
                    className="bg-slate-900/50 border-slate-800 text-slate-500 text-sm"
                  />
                  <p className="text-[10px] text-slate-500">Email is linked to authentication credentials.</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="flex items-center gap-2 text-xs text-slate-300">
                    <Phone className="w-3.5 h-3.5 text-slate-500" /> Phone Number
                  </Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    disabled={!isEditing}
                    className="bg-slate-900 border-slate-800 text-white text-sm"
                    placeholder="Enter phone number"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RESPONDER LOCATION & ALERT PREFERENCES (Only for VOLUNTEER, NGO, STAFF, ADMIN) */}
        {isResponder && (
          <Card className="border-slate-800 bg-[#0A0F1C] shadow-xl rounded-2xl overflow-hidden">
            <CardHeader className="border-b border-slate-800 bg-slate-900/40 py-4 px-6 flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <BellRing size={18} />
                </div>
                <div>
                  <CardTitle className="text-base font-bold text-white">Emergency Dispatch Alerts & Location Range</CardTitle>
                  <CardDescription className="text-xs text-slate-400">
                    Set your base deployment coordinates and radius to receive alerts for nearby critical rescues.
                  </CardDescription>
                </div>
              </div>
              <Badge className={alertsEnabled ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs" : "bg-slate-800 text-slate-400 text-xs"}>
                {alertsEnabled ? "Alerts Active" : "Alerts Paused"}
              </Badge>
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              {/* Alert Toggle */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                <div className="space-y-0.5">
                  <span className="text-sm font-bold text-white">Receive Emergency SOS Notifications</span>
                  <p className="text-xs text-slate-400">
                    Get real-time notification alerts when critical or high severity rescues are reported in your area.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={alertsEnabled}
                    onChange={(e) => setAlertsEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              {/* GPS Base Coordinates */}
              <div className="grid gap-4 sm:grid-cols-2 items-center">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300 flex items-center gap-1.5">
                    <MapPin size={14} className="text-emerald-400" /> Dispatch Base Coordinates
                  </Label>
                  <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-xs font-mono text-slate-300 flex items-center justify-between">
                    <span>
                      {location.lat && location.lon ? `${location.lat}, ${location.lon}` : "Not configured (spatial alerts disabled)"}
                    </span>
                    {location.lat && (
                      <button
                        onClick={() => setLocation({ lat: null, lon: null })}
                        className="text-[11px] text-slate-500 hover:text-slate-300 underline"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>

                <div className="pt-5 flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleDetectLocation}
                    disabled={isDetectingGps}
                    className="border-slate-700 text-slate-300 hover:bg-slate-800 text-xs h-9 flex items-center gap-1.5"
                  >
                    {isDetectingGps ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5 text-blue-400" />}
                    Detect GPS Location
                  </Button>
                </div>
              </div>

              {/* Service Radius Selector */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <Label className="text-slate-300 font-semibold">Service Coverage Radius</Label>
                  <span className="font-bold text-emerald-400">{serviceRadiusKm} km</span>
                </div>
                <div className="flex gap-2">
                  {RADIUS_OPTIONS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setServiceRadiusKm(r)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                        serviceRadiusKm === r
                          ? "bg-emerald-500 text-emerald-950 border-emerald-400 font-black"
                          : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      {r} km
                    </button>
                  ))}
                </div>
              </div>

              {/* Privacy Notice */}
              <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800/80 flex items-start gap-2.5 text-[11px] text-slate-400">
                <Info size={14} className="text-blue-400 shrink-0 mt-0.5" />
                <span>
                  Your dispatch coordinates are private and strictly confidential—they are never shared with citizens, 
                  other responders, or exposed via public APIs. The system uses secure backend distance calculation 
                  to notify you only when an animal requires rescue within your specified radius. Resetting coordinates 
                  or pausing alerts stops nearby notifications.
                </span>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  size="sm"
                  onClick={handleSaveAlerts}
                  disabled={isSavingAlerts}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4"
                >
                  {isSavingAlerts ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                  Save Alert Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ROLE CLEARANCE REQUEST CARD */}
        <Card className="border-slate-800 bg-[#0A0F1C] shadow-xl rounded-2xl overflow-hidden">
          <CardHeader className="border-b border-slate-800 bg-slate-900/40 py-4 px-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <ShieldCheck size={18} />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-white">Personnel Clearance & Role Upgrades</CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Request access to volunteer dispatches, shelter operations, NGO coordination, or veterinary triage.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {hasPendingRoleRequest ? (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/80 border border-slate-800">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-amber-400 shrink-0" />
                  <div>
                    <span className="text-sm font-bold text-white">Pending Clearance: {user.requestedRole}</span>
                    <p className="text-xs text-slate-400">
                      Submitted for administrative review. If you need to make corrections or re-upload your document, you can withdraw this request.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                  <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs">
                    In Review
                  </Badge>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isWithdrawingClearance}
                    onClick={handleWithdrawClearance}
                    className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 text-xs h-8"
                  >
                    {isWithdrawingClearance ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                    Withdraw Request
                  </Button>
                </div>
              </div>
            ) : user.role === "ADMIN" ? (
              <div className="text-sm text-slate-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                You hold Administrator clearance with full access across all operations.
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-slate-400">
                  Select the organizational clearance level that corresponds to your verified organization or volunteer role:
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {ALLOWED_REQUESTED_ROLES.map((role) => (
                    <label
                      key={role.value}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                        selectedRole === role.value
                          ? "border-emerald-500 bg-emerald-500/5 text-white"
                          : "border-slate-800 bg-slate-900/40 text-slate-300 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <span className="text-sm font-bold">{role.label}</span>
                        <input
                          type="radio"
                          name="requestedRole"
                          value={role.value}
                          checked={selectedRole === role.value}
                          onChange={(e) => setSelectedRole(e.target.value)}
                          className="mt-1 accent-emerald-500"
                        />
                      </div>
                      <p className="text-xs text-slate-400 mt-2">{role.description}</p>
                    </label>
                  ))}
                </div>

                <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 space-y-3 mt-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Identification Card & Credential Verification</span>
                  </div>
                  
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">
                        Document Type
                      </label>
                      <select
                        value={idCardType}
                        onChange={(e) => setIdCardType(e.target.value)}
                        className="w-full bg-[#131B2C] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                      >
                        <option value="Government Photo ID">Government Photo ID (Aadhaar / DL / Passport)</option>
                        <option value="NGO Registration Certificate">NGO Registration / Society Certificate</option>
                        <option value="Animal Shelter License">Shelter / Animal Welfare License</option>
                        <option value="Veterinary Medical Council ID">Veterinary Council Registration</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">
                        ID / License / Reg Number *
                      </label>
                      <input
                        type="text"
                        value={idCardNumber}
                        onChange={(e) => setIdCardNumber(e.target.value)}
                        placeholder="e.g. DL-1420110012345 or NGO/2023/8921"
                        className="w-full bg-[#131B2C] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">
                      ID Document / Certificate Proof
                    </label>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <label className="cursor-pointer bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl px-3 py-2 text-xs font-medium inline-flex items-center gap-1.5 transition">
                          {isUploadingDoc ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5 text-emerald-400" />}
                          {isUploadingDoc ? "Uploading..." : idCardUrl ? "Replace ID Document" : "Upload File (Private)"}
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            onChange={handleIdFileUpload}
                            disabled={isUploadingDoc}
                            className="hidden"
                          />
                        </label>
                        {idCardUrl && (
                          <span className="text-[11px] text-emerald-400 truncate max-w-xs font-mono bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                            {idCardUrl}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <Button
                    onClick={handleRoleRequest}
                    disabled={isSubmittingRole}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-5"
                  >
                    {isSubmittingRole ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Submitting...
                      </>
                    ) : (
                      "Submit Clearance Request"
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default ProfilePage;
