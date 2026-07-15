import { useState, useEffect, useCallback } from "react";
import {
  Building2, Info, Users, Palette, Database, Save, Loader2,
} from "lucide-react";
import PageHeader from "../../components/shared/PageHeader";
import api from "../../services/api";
import { toast } from "sonner";

const MENU = [
  { label: "Municipality Info", icon: Building2, id: "muni" },
  { label: "System Info",       icon: Info,      id: "system" },
  { label: "User Settings",     icon: Users,     id: "user" },
  { label: "Theme",             icon: Palette,   id: "theme" },
  { label: "Backup & Restore",  icon: Database,  id: "backup" },
];

// Only "muni" (Municipality Info) is wired to a real backend right now
// — GET/PUT /api/settings/municipality. The other four tabs are either
// purely informational (System Info has nothing to save), belong to a
// different feature entirely (User Settings should reuse the existing
// /users/:id account-management endpoint, not municipality config),
// or are real features that haven't been built yet (Theme switching,
// Backup & Restore). The Save button is disabled on all of those
// rather than showing a fake success toast that doesn't persist
// anything — see the SAVEABLE_TABS check below.
const SAVEABLE_TABS = ["muni"];

const EMPTY_MUNI_FORM = {
  municipalityName: "",
  province: "",
  region: "",
  postalCode: "",
  mayorName: "",
  municipalTreasurer: "",
  bploOfficer: "",
  municipalAccountant: "",
};

export default function SettingsPage() {
  const [active, setActive] = useState("muni");
  const [saving, setSaving] = useState(false);
  const [loadingMuni, setLoadingMuni] = useState(true);
  const [muniForm, setMuniForm] = useState(EMPTY_MUNI_FORM);

  const fetchMuniSettings = useCallback(async () => {
    setLoadingMuni(true);
    try {
      const { data } = await api.get("/settings/municipality");
      const s = data.settings;
      setMuniForm({
        municipalityName: s.municipalityName || "",
        province: s.province || "",
        region: s.region || "",
        postalCode: s.postalCode || "",
        mayorName: s.mayorName || "",
        municipalTreasurer: s.municipalTreasurer || "",
        bploOfficer: s.bploOfficer || "",
        municipalAccountant: s.municipalAccountant || "",
      });
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load municipality settings.");
    } finally {
      setLoadingMuni(false);
    }
  }, []);

  useEffect(() => {
    fetchMuniSettings();
  }, [fetchMuniSettings]);

  const setMuniField = (field, value) => setMuniForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (active === "muni") {
      setSaving(true);
      try {
        const { data } = await api.put("/settings/municipality", muniForm);
        const s = data.settings;
        setMuniForm({
          municipalityName: s.municipalityName || "",
          province: s.province || "",
          region: s.region || "",
          postalCode: s.postalCode || "",
          mayorName: s.mayorName || "",
          municipalTreasurer: s.municipalTreasurer || "",
          bploOfficer: s.bploOfficer || "",
          municipalAccountant: s.municipalAccountant || "",
        });
        toast.success("Municipality information saved.");
      } catch (err) {
        toast.error(err.response?.data?.message || "Failed to save municipality settings.");
      } finally {
        setSaving(false);
      }
      return;
    }
    // Every other tab: Save is disabled in the UI (see the button below),
    // so this branch should be unreachable — kept only as a defensive
    // fallback that does nothing rather than silently lying about success.
  };

  const canSave = SAVEABLE_TABS.includes(active);

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="System configuration and municipality information"
      />

      <div className="grid gap-4" style={{ gridTemplateColumns: "200px 1fr" }}>
        {/* Side Menu */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-2 h-fit">
          {MENU.map((m) => (
            <button
              key={m.id}
              onClick={() => setActive(m.id)}
              className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-md text-[12px] mb-1 transition-colors ${
                active === m.id
                  ? "bg-[#EBF0FA] text-[#1E4E9D] font-semibold"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <m.icon size={14} />
              {m.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
          {active === "muni" && (
            <div>
              <h3 className="font-bold text-[14px] text-gray-900 mb-4 pb-3 border-b border-gray-100">
                Municipality Information
              </h3>

              {loadingMuni ? (
                <div className="flex items-center justify-center gap-2 py-10 text-gray-400 text-[12px]">
                  <Loader2 size={16} className="animate-spin" /> Loading...
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: "Municipality Name",    field: "municipalityName", required: true },
                      { label: "Province",             field: "province", required: true },
                      { label: "Region",               field: "region", required: true },
                      { label: "Postal Code",          field: "postalCode" },
                      { label: "Mayor's Name",         field: "mayorName" },
                      { label: "Municipal Treasurer",  field: "municipalTreasurer" },
                      { label: "BPLO Officer",         field: "bploOfficer" },
                      { label: "Municipal Accountant", field: "municipalAccountant" },
                    ].map((f) => (
                      <div key={f.field}>
                        <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">
                          {f.label}{f.required && " *"}
                        </label>
                        <input
                          required={f.required}
                          value={muniForm[f.field]}
                          onChange={(e) => setMuniField(f.field, e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-[13px] focus:outline-none focus:ring-2 focus:ring-[#1E4E9D]/30"
                        />
                      </div>
                    ))}
                  </div>

                  <h3 className="font-bold text-[14px] text-gray-900 mt-6 mb-4 pb-3 border-b border-gray-100">
                    Tax Rate Configuration
                  </h3>
                  <p className="text-[11px] text-gray-400 mb-3">
                    These values are governed by the Sta. Catalina Local Revenue Code and are not
                    editable from this screen.
                  </p>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { label: "Late Payment Interest Rate", val: "25%" },
                      { label: "Quarterly Due Dates", val: "Mar 20 / Jun 20 / Sep 20 / Dec 20" },
                      { label: "Annual Due Date", val: "Jan 20" },
                    ].map((f) => (
                      <div key={f.label}>
                        <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">
                          {f.label}
                        </label>
                        <input
                          value={f.val}
                          readOnly
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-[13px] bg-gray-50 text-gray-500"
                        />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {active === "system" && (
            <div>
              <h3 className="font-bold text-[14px] text-gray-900 mb-4 pb-3 border-b border-gray-100">
                System Information
              </h3>
              <p className="text-[11px] text-gray-400 mb-3">
                Informational only — there is nothing to save on this tab.
              </p>
              <div className="space-y-3">
                {[
                  { label: "System Name",    value: "Sta. Catalina Revenue System" },
                  { label: "Version",        value: "v1.0.0" },
                  { label: "Database",       value: "MySQL" },
                  { label: "Technology",     value: "React + Vite + Node.js + Express + Electron" },
                  { label: "Developer",      value: "Municipal IT Unit" },
                ].map((i) => (
                  <div key={i.label} className="flex items-center justify-between py-2 border-b border-gray-50">
                    <span className="text-[12px] text-gray-500 font-medium">{i.label}</span>
                    <span className="text-[12px] font-semibold text-gray-800">{i.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {active === "user" && (
            <div>
              <h3 className="font-bold text-[14px] text-gray-900 mb-4 pb-3 border-b border-gray-100">
                User Preferences
              </h3>
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 text-[11px] text-amber-800 mb-4">
                Your own account's name, password, and role are managed from the User Management
                page, not here. This tab is not yet wired up.
              </div>
              <div className="grid grid-cols-2 gap-4 opacity-50">
                {[
                  { label: "Display Name" },
                  { label: "Email Address" },
                ].map((f) => (
                  <div key={f.label}>
                    <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">
                      {f.label}
                    </label>
                    <input disabled className="w-full px-3 py-2 border border-gray-300 rounded-md text-[13px] bg-gray-100" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {active === "theme" && (
            <div>
              <h3 className="font-bold text-[14px] text-gray-900 mb-4 pb-3 border-b border-gray-100">
                Theme Settings
              </h3>
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 text-[11px] text-amber-800 mb-4">
                Theme switching is not yet implemented. The system currently always uses the
                Government Blue theme shown below.
              </div>
              <div className="space-y-3 opacity-50">
                <p className="text-[12px] text-gray-500">
                  Current theme: <strong className="text-[#1E4E9D]">Government Blue</strong>
                </p>
                <div className="flex gap-3 mt-3">
                  {[
                    { name: "Government Blue", primary: "#1E4E9D", gold: "#D4AF37" },
                    { name: "Forest Green",    primary: "#166534", gold: "#CA8A04" },
                    { name: "Deep Maroon",     primary: "#7F1D1D", gold: "#B45309" },
                  ].map((t) => (
                    <div
                      key={t.name}
                      className="p-3 border-2 border-gray-200 rounded-lg text-left w-36 cursor-not-allowed"
                    >
                      <div className="flex gap-1.5 mb-2">
                        <div className="w-6 h-6 rounded" style={{ background: t.primary }} />
                        <div className="w-6 h-6 rounded" style={{ background: t.gold }} />
                      </div>
                      <p className="text-[10px] font-semibold text-gray-700">{t.name}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {active === "backup" && (
            <div>
              <h3 className="font-bold text-[14px] text-gray-900 mb-4 pb-3 border-b border-gray-100">
                Backup & Restore
              </h3>
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 text-[11px] text-amber-800 mb-4">
                Backup and restore are not yet implemented.
              </div>
              <div className="space-y-3 opacity-50">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-[12px] text-blue-800 font-semibold mb-1">Manual Backup</p>
                  <p className="text-[11px] text-blue-600 mb-3">
                    Download a full backup of the database.
                  </p>
                  <button disabled className="px-4 py-2 bg-gray-400 text-white text-[12px] font-semibold rounded-md cursor-not-allowed">
                    Download Backup
                  </button>
                </div>
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-[12px] text-yellow-800 font-semibold mb-1">Restore Database</p>
                  <p className="text-[11px] text-yellow-700 mb-3">
                    Restore from a previous backup file. This will overwrite current data.
                  </p>
                  <button disabled className="px-4 py-2 bg-gray-400 text-white text-[12px] font-semibold rounded-md cursor-not-allowed">
                    Choose Backup File
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Save button — only enabled on tabs in SAVEABLE_TABS. Every
              other tab shows a disabled button rather than a working one
              that lies about saving something. */}
          <div className="flex justify-end mt-6 pt-4 border-t border-gray-100">
            <button
              onClick={handleSave}
              disabled={!canSave || saving || loadingMuni}
              title={!canSave ? "This section is not yet editable" : undefined}
              className="flex items-center gap-2 px-5 py-2 bg-[#1E4E9D] text-white rounded-md text-[12px] font-semibold hover:bg-[#163d7a] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Save size={13} />
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}