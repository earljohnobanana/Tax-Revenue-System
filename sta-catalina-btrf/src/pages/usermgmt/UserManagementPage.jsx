import { useState, useEffect, useCallback } from "react";
import { Plus, Edit, Ban, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import PageHeader from "../../components/shared/PageHeader";
import StatusBadge from "../../components/shared/StatusBadge";
import api from "../../services/api";

const ROLES = ["Administrator", "Treasurer", "BPLO Staff", "Accounting Staff", "Viewer"];

const ROLE_COLORS = {
  Administrator:    "bg-purple-100 text-purple-800 border border-purple-200",
  Treasurer:        "bg-yellow-100 text-yellow-800 border border-yellow-200",
  "BPLO Staff":     "bg-blue-100 text-blue-800 border border-blue-200",
  "Accounting Staff":"bg-green-100 text-green-800 border border-green-200",
  Viewer:           "bg-gray-100 text-gray-600 border border-gray-200",
};

const EMPTY_FORM = { name: "", username: "", password: "", role: "BPLO Staff", office: "" };

export default function UserManagementPage() {
  const [users, setUsers]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [showModal, setShowModal]     = useState(false);
  const [editingUser, setEditingUser] = useState(null); // null = create mode
  const [form, setForm]               = useState(EMPTY_FORM);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/users");
      setUsers(data.users);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load users.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const openAddModal = () => {
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEditModal = (u) => {
    setEditingUser(u);
    setForm({ name: u.name, username: u.username, password: "", role: u.role, office: u.office || "" });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingUser) {
        await api.put(`/users/${editingUser.id}`, {
          name: form.name,
          role: form.role,
          office: form.office,
        });
        toast.success("User account updated.");
      } else {
        await api.post("/users", form);
        toast.success("User account created.");
      }
      setShowModal(false);
      setForm(EMPTY_FORM);
      setEditingUser(null);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save user.");
    }
  };

  const handleToggleStatus = async (u) => {
    const action = u.status === "Active" ? "deactivate" : "activate";
    if (!window.confirm(`${action === "deactivate" ? "Deactivate" : "Activate"} ${u.name}'s account?`)) return;

    try {
      await api.patch(`/users/${u.id}/status`);
      toast.success(`Account ${action}d.`);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed to ${action} account.`);
    }
  };

  return (
    <div>
      <PageHeader
        title="User Management"
        subtitle="Manage system users, roles, and access permissions"
      >
        <button
          onClick={openAddModal}
          className="flex items-center gap-1.5 px-3 py-2 bg-[#1E4E9D] text-white rounded-md text-[12px] font-semibold hover:bg-[#163d7a]"
        >
          <Plus size={13} /> Add User
        </button>
      </PageHeader>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <table className="gov-table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Full Name</th>
              <th>Role</th>
              <th>Office / Department</th>
              <th style={{ textAlign: "center" }}>Status</th>
              <th>Last Login</th>
              <th style={{ textAlign: "center" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400 text-[12px]">Loading users...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400 text-[12px]">No users found.</td></tr>
            ) : (
              users.map((u) => (
                <tr key={u.id}>
                  <td className="font-mono text-[11px] font-bold text-[#1E4E9D]">{u.username}</td>
                  <td className="font-semibold text-[12px]">{u.name}</td>
                  <td>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                        ROLE_COLORS[u.role] || "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="text-[11px] text-gray-500">{u.office || "—"}</td>
                  <td style={{ textAlign: "center" }}>
                    <StatusBadge status={u.status} />
                  </td>
                  <td className="font-mono text-[10px] text-gray-400">{u.lastLogin}</td>
                  <td style={{ textAlign: "center" }}>
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => openEditModal(u)}
                        title="Edit user"
                        className="w-6 h-6 flex items-center justify-center rounded hover:bg-yellow-50 text-yellow-600"
                      >
                        <Edit size={12} />
                      </button>
                      <button
                        onClick={() => handleToggleStatus(u)}
                        title={u.status === "Active" ? "Deactivate user" : "Activate user"}
                        className={`w-6 h-6 flex items-center justify-center rounded ${
                          u.status === "Active"
                            ? "hover:bg-red-50 text-red-500"
                            : "hover:bg-green-50 text-green-600"
                        }`}
                      >
                        {u.status === "Active" ? <Ban size={12} /> : <RotateCcw size={12} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h2 className="font-bold text-[15px]">{editingUser ? "Edit User" : "Add New User"}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 text-xl">×</button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">
                  Full Name *
                </label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Name in CAPS"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-[13px] focus:outline-none focus:ring-2 focus:ring-[#1E4E9D]/30"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">
                  Username *
                </label>
                <input
                  required
                  disabled={!!editingUser}
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  placeholder="Login username"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-[13px] focus:outline-none focus:ring-2 focus:ring-[#1E4E9D]/30 disabled:bg-gray-100 disabled:text-gray-500"
                />
                {editingUser && (
                  <p className="text-[10px] text-gray-400 mt-1">Username can't be changed after creation.</p>
                )}
              </div>

              {!editingUser && (
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">
                    Temporary Password *
                  </label>
                  <input
                    required
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="Initial login password"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-[13px] focus:outline-none focus:ring-2 focus:ring-[#1E4E9D]/30"
                  />
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">
                  Office/Department
                </label>
                <input
                  value={form.office}
                  onChange={(e) => setForm({ ...form, office: e.target.value })}
                  placeholder="e.g. Municipal Treasurer's Office"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-[13px] focus:outline-none focus:ring-2 focus:ring-[#1E4E9D]/30"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">
                  Role *
                </label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-[#1E4E9D]/30"
                >
                  {ROLES.map((r) => <option key={r}>{r}</option>)}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-[12px] hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit"
                  className="px-4 py-2 bg-[#1E4E9D] text-white rounded-md text-[12px] font-semibold hover:bg-[#163d7a]">
                  {editingUser ? "Save Changes" : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}