import { useState, useEffect } from "react";
import {
  Users, Search, Plus, Pencil, Trash2, DollarSign, Shield, Ban,
  CheckCircle2, Clock, XCircle, Eye, UserPlus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface UserRow {
  id: string;
  user_id: string;
  dealership_name: string;
  contact_person: string;
  email: string;
  phone: string | null;
  province: string | null;
  approval_status: string;
  subscription_tier: string;
  wallet_balance: number;
  created_at: string;
  address: string | null;
  business_type: string | null;
  website: string | null;
  roles: string[];
}

const statusConfig: Record<string, { color: string; icon: typeof CheckCircle2 }> = {
  approved: { color: "bg-success/20 text-success", icon: CheckCircle2 },
  pending: { color: "bg-warning/20 text-warning", icon: Clock },
  rejected: { color: "bg-destructive/20 text-destructive", icon: XCircle },
  suspended: { color: "bg-muted text-muted-foreground", icon: Ban },
};

const AdminUserManager = () => {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Dialogs
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [addFundsOpen, setAddFundsOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [addUserOpen, setAddUserOpen] = useState(false);

  // Edit form
  const [editForm, setEditForm] = useState({
    dealership_name: "", contact_person: "", email: "", phone: "",
    province: "", address: "", business_type: "independent", website: "",
    approval_status: "pending", subscription_tier: "basic",
  });

  // Add funds
  const [fundAmount, setFundAmount] = useState("");
  const [fundDescription, setFundDescription] = useState("Admin deposit");

  // Role management
  const [userRole, setUserRole] = useState<string>("user");

  // Add user form
  const [newUserForm, setNewUserForm] = useState({
    email: "", password: "", dealership_name: "", contact_person: "",
    phone: "", province: "", approval_status: "approved",
  });

  const [saving, setSaving] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    const [{ data: dealers }, { data: roles }] = await Promise.all([
      supabase.from("dealers").select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("*"),
    ]);

    const rolesMap: Record<string, string[]> = {};
    (roles ?? []).forEach((r: any) => {
      if (!rolesMap[r.user_id]) rolesMap[r.user_id] = [];
      rolesMap[r.user_id].push(r.role);
    });

    const mapped: UserRow[] = (dealers ?? []).map((d: any) => ({
      ...d,
      roles: rolesMap[d.user_id] ?? ["user"],
    }));
    setUsers(mapped);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const filteredUsers = users.filter((u) => {
    const matchSearch =
      u.dealership_name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.contact_person.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === "all" || u.roles.includes(roleFilter);
    const matchStatus = statusFilter === "all" || u.approval_status === statusFilter;
    return matchSearch && matchRole && matchStatus;
  });

  /* ─── Edit User ─── */
  const openEdit = (u: UserRow) => {
    setSelectedUser(u);
    setEditForm({
      dealership_name: u.dealership_name,
      contact_person: u.contact_person,
      email: u.email,
      phone: u.phone ?? "",
      province: u.province ?? "",
      address: u.address ?? "",
      business_type: u.business_type ?? "independent",
      website: u.website ?? "",
      approval_status: u.approval_status,
      subscription_tier: u.subscription_tier,
    });
    setUserRole(u.roles.includes("admin") ? "admin" : u.roles.includes("moderator") ? "moderator" : "user");
    setEditMode(true);
  };

  const saveEdit = async () => {
    if (!selectedUser) return;
    setSaving(true);

    const { error } = await supabase.from("dealers").update({
      dealership_name: editForm.dealership_name,
      contact_person: editForm.contact_person,
      email: editForm.email,
      phone: editForm.phone || null,
      province: editForm.province || null,
      address: editForm.address || null,
      business_type: editForm.business_type || null,
      website: editForm.website || null,
      approval_status: editForm.approval_status,
      subscription_tier: editForm.subscription_tier,
    }).eq("id", selectedUser.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setSaving(false);
      return;
    }

    // Update role
    const currentRole = selectedUser.roles.includes("admin") ? "admin" : selectedUser.roles.includes("moderator") ? "moderator" : "user";
    if (userRole !== currentRole) {
      // Remove old non-user roles
      await supabase.from("user_roles").delete().eq("user_id", selectedUser.user_id);
      if (userRole !== "user") {
        await supabase.from("user_roles").insert({ user_id: selectedUser.user_id, role: userRole as any });
      }
    }

    toast({ title: "Updated", description: "User updated successfully." });
    setSaving(false);
    setEditMode(false);
    setSelectedUser(null);
    fetchUsers();
  };

  /* ─── Add Funds ─── */
  const openAddFunds = (u: UserRow) => {
    setSelectedUser(u);
    setFundAmount("");
    setFundDescription("Admin deposit");
    setAddFundsOpen(true);
  };

  const submitAddFunds = async () => {
    if (!selectedUser || !fundAmount) return;
    const amount = parseFloat(fundAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Invalid amount", variant: "destructive" });
      return;
    }
    setSaving(true);
    const newBalance = Number(selectedUser.wallet_balance) + amount;

    const { error: txError } = await supabase.from("wallet_transactions").insert({
      dealer_id: selectedUser.id,
      amount,
      balance_after: newBalance,
      type: "deposit",
      description: fundDescription || "Admin deposit",
      reference_id: `admin-${Date.now()}`,
    });

    if (txError) {
      toast({ title: "Error", description: txError.message, variant: "destructive" });
      setSaving(false);
      return;
    }

    const { error: balError } = await supabase.from("dealers").update({ wallet_balance: newBalance }).eq("id", selectedUser.id);
    if (balError) {
      toast({ title: "Error updating balance", description: balError.message, variant: "destructive" });
    } else {
      toast({ title: "Funds Added", description: `$${amount.toFixed(2)} added to ${selectedUser.dealership_name}.` });
    }

    setSaving(false);
    setAddFundsOpen(false);
    setSelectedUser(null);
    fetchUsers();
  };

  /* ─── Delete User ─── */
  const openDelete = (u: UserRow) => {
    setSelectedUser(u);
    setDeleteConfirm(true);
  };

  const confirmDeleteUser = async () => {
    if (!selectedUser) return;
    setSaving(true);
    // Delete dealer record (cascades handled by DB)
    const { error } = await supabase.from("dealers").delete().eq("id", selectedUser.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Deleted", description: `${selectedUser.dealership_name} has been removed.` });
    }
    setSaving(false);
    setDeleteConfirm(false);
    setSelectedUser(null);
    fetchUsers();
  };

  /* ─── Add New User ─── */
  const submitNewUser = async () => {
    if (!newUserForm.email || !newUserForm.password || !newUserForm.dealership_name || !newUserForm.contact_person) {
      toast({ title: "Missing fields", description: "Email, password, dealership name and contact person are required.", variant: "destructive" });
      return;
    }
    setSaving(true);

    // Create auth user via edge function or direct signup
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: newUserForm.email,
      password: newUserForm.password,
      options: { data: { dealership_name: newUserForm.dealership_name } },
    });

    if (authError || !authData.user) {
      toast({ title: "Error creating user", description: authError?.message ?? "Unknown error", variant: "destructive" });
      setSaving(false);
      return;
    }

    // Insert dealer record
    const { error: dealerError } = await supabase.from("dealers").insert({
      user_id: authData.user.id,
      dealership_name: newUserForm.dealership_name,
      contact_person: newUserForm.contact_person,
      email: newUserForm.email,
      phone: newUserForm.phone || null,
      province: newUserForm.province || null,
      approval_status: newUserForm.approval_status,
    });

    if (dealerError) {
      toast({ title: "Error creating dealer", description: dealerError.message, variant: "destructive" });
    } else {
      toast({ title: "User Created", description: `${newUserForm.dealership_name} has been added.` });
    }

    setSaving(false);
    setAddUserOpen(false);
    setNewUserForm({ email: "", password: "", dealership_name: "", contact_person: "", phone: "", province: "", approval_status: "approved" });
    fetchUsers();
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-card rounded-lg" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 flex-1 w-full">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-card border-border"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px] bg-card border-border">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[130px] bg-card border-border">
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="moderator">Moderator</SelectItem>
              <SelectItem value="user">User</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" className="gap-2" onClick={() => setAddUserOpen(true)}>
          <UserPlus className="h-4 w-4" /> Add User
        </Button>
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-xs text-muted-foreground">
        <span>{filteredUsers.length} user{filteredUsers.length !== 1 ? "s" : ""} shown</span>
        <span>·</span>
        <span>{users.filter(u => u.roles.includes("admin")).length} admins</span>
        <span>·</span>
        <span>{users.filter(u => u.approval_status === "pending").length} pending</span>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-3 text-xs text-muted-foreground font-medium">User</th>
                <th className="text-left p-3 text-xs text-muted-foreground font-medium">Contact</th>
                <th className="text-left p-3 text-xs text-muted-foreground font-medium">Status</th>
                <th className="text-left p-3 text-xs text-muted-foreground font-medium">Role</th>
                <th className="text-left p-3 text-xs text-muted-foreground font-medium">Tier</th>
                <th className="text-right p-3 text-xs text-muted-foreground font-medium">Balance</th>
                <th className="text-right p-3 text-xs text-muted-foreground font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredUsers.map((u) => {
                const st = statusConfig[u.approval_status] ?? statusConfig.pending;
                const StIcon = st.icon;
                const role = u.roles.includes("admin") ? "admin" : u.roles.includes("moderator") ? "moderator" : "user";
                return (
                  <tr key={u.id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-3">
                      <p className="font-medium text-foreground">{u.dealership_name}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </td>
                    <td className="p-3 text-muted-foreground">
                      <p>{u.contact_person}</p>
                      <p className="text-xs">{u.phone ?? "—"}</p>
                    </td>
                    <td className="p-3">
                      <Badge className={cn("gap-1 border-0 text-[10px]", st.color)}>
                        <StIcon className="h-3 w-3" />
                        {u.approval_status}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <Badge variant={role === "admin" ? "default" : "outline"} className="text-[10px] capitalize">
                        {role === "admin" && <Shield className="h-3 w-3 mr-1" />}
                        {role}
                      </Badge>
                    </td>
                    <td className="p-3 capitalize text-muted-foreground">{u.subscription_tier}</td>
                    <td className="p-3 text-right font-mono text-foreground">${Number(u.wallet_balance).toFixed(2)}</td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit" onClick={() => openEdit(u)}>
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Add Funds" onClick={() => openAddFunds(u)}>
                          <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Delete" onClick={() => openDelete(u)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">No users found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Edit User Dialog ─── */}
      <Dialog open={editMode} onOpenChange={() => { setEditMode(false); setSelectedUser(null); }}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">Edit User</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Dealership Name</Label>
              <Input value={editForm.dealership_name} onChange={(e) => setEditForm(f => ({ ...f, dealership_name: e.target.value }))} className="bg-background border-border" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Contact Person</Label>
              <Input value={editForm.contact_person} onChange={(e) => setEditForm(f => ({ ...f, contact_person: e.target.value }))} className="bg-background border-border" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Email</Label>
              <Input value={editForm.email} onChange={(e) => setEditForm(f => ({ ...f, email: e.target.value }))} className="bg-background border-border" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Phone</Label>
              <Input value={editForm.phone} onChange={(e) => setEditForm(f => ({ ...f, phone: e.target.value }))} className="bg-background border-border" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Province</Label>
              <Input value={editForm.province} onChange={(e) => setEditForm(f => ({ ...f, province: e.target.value }))} className="bg-background border-border" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Address</Label>
              <Input value={editForm.address} onChange={(e) => setEditForm(f => ({ ...f, address: e.target.value }))} className="bg-background border-border" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Business Type</Label>
              <Select value={editForm.business_type} onValueChange={(v) => setEditForm(f => ({ ...f, business_type: v }))}>
                <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="independent">Independent</SelectItem>
                  <SelectItem value="franchise">Franchise</SelectItem>
                  <SelectItem value="broker">Broker</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Website</Label>
              <Input value={editForm.website} onChange={(e) => setEditForm(f => ({ ...f, website: e.target.value }))} className="bg-background border-border" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={editForm.approval_status} onValueChange={(v) => setEditForm(f => ({ ...f, approval_status: v }))}>
                <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Subscription Tier</Label>
              <Select value={editForm.subscription_tier} onValueChange={(v) => setEditForm(f => ({ ...f, subscription_tier: v }))}>
                <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">Basic</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="elite">Elite</SelectItem>
                  <SelectItem value="vip">VIP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs text-muted-foreground">Role</Label>
              <Select value={userRole} onValueChange={setUserRole}>
                <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="moderator">Moderator</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditMode(false); setSelectedUser(null); }}>Cancel</Button>
            <Button disabled={saving} onClick={saveEdit}>
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Add Funds Dialog ─── */}
      <Dialog open={addFundsOpen} onOpenChange={() => { setAddFundsOpen(false); setSelectedUser(null); }}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground">Add Funds — {selectedUser?.dealership_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Current balance: <span className="font-mono text-foreground">${Number(selectedUser?.wallet_balance ?? 0).toFixed(2)}</span></p>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Amount ($)</Label>
              <Input type="number" min={0} step="0.01" value={fundAmount} onChange={(e) => setFundAmount(e.target.value)} className="bg-background border-border" placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Description</Label>
              <Input value={fundDescription} onChange={(e) => setFundDescription(e.target.value)} className="bg-background border-border" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddFundsOpen(false); setSelectedUser(null); }}>Cancel</Button>
            <Button disabled={saving || !fundAmount} onClick={submitAddFunds}>
              {saving ? "Adding…" : "Add Funds"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirm Dialog ─── */}
      <Dialog open={deleteConfirm} onOpenChange={() => { setDeleteConfirm(false); setSelectedUser(null); }}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete User</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <strong className="text-foreground">{selectedUser?.dealership_name}</strong>? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteConfirm(false); setSelectedUser(null); }}>Cancel</Button>
            <Button variant="destructive" disabled={saving} onClick={confirmDeleteUser}>
              {saving ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Add User Dialog ─── */}
      <Dialog open={addUserOpen} onOpenChange={() => setAddUserOpen(false)}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground">Add New User</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Email *</Label>
              <Input value={newUserForm.email} onChange={(e) => setNewUserForm(f => ({ ...f, email: e.target.value }))} className="bg-background border-border" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Password *</Label>
              <Input type="password" value={newUserForm.password} onChange={(e) => setNewUserForm(f => ({ ...f, password: e.target.value }))} className="bg-background border-border" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Dealership Name *</Label>
              <Input value={newUserForm.dealership_name} onChange={(e) => setNewUserForm(f => ({ ...f, dealership_name: e.target.value }))} className="bg-background border-border" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Contact Person *</Label>
              <Input value={newUserForm.contact_person} onChange={(e) => setNewUserForm(f => ({ ...f, contact_person: e.target.value }))} className="bg-background border-border" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Phone</Label>
              <Input value={newUserForm.phone} onChange={(e) => setNewUserForm(f => ({ ...f, phone: e.target.value }))} className="bg-background border-border" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Province</Label>
              <Input value={newUserForm.province} onChange={(e) => setNewUserForm(f => ({ ...f, province: e.target.value }))} className="bg-background border-border" />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs text-muted-foreground">Initial Status</Label>
              <Select value={newUserForm.approval_status} onValueChange={(v) => setNewUserForm(f => ({ ...f, approval_status: v }))}>
                <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddUserOpen(false)}>Cancel</Button>
            <Button disabled={saving} onClick={submitNewUser}>
              {saving ? "Creating…" : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminUserManager;
