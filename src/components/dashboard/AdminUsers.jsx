import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search, ShieldAlert, MessageSquare, Eye, CalendarClock, Handshake,
  Building2, X, Loader2,
} from "lucide-react";
import { supabase } from "../../lib/supabaseclient";
import { useAuth } from "../../context/AuthContext";
import { timeAgo } from "../../utils/timeAgo";
import "../../styles/AdminUsers.css";

const mp = () => supabase.schema("marketplace");

// ⚠ REQUIRED MIGRATION — marketplace.profiles has no suspend/ban column
// yet (confirmed via information_schema: nothing named %suspend%/%ban%/
// %active%/%status% exists on profiles itself). Run this before the
// Suspend/Reactivate button below will work — without it, the profile
// select below will fail outright with "column does not exist":
//
//   alter table marketplace.profiles
//     add column is_suspended boolean not null default false,
//     add column suspended_at timestamptz null,
//     add column suspended_reason text null;
//
// Also confirm an RLS policy lets admins (marketplace.admin_users
// membership) UPDATE role / is_suspended / etc. on ANY profile row —
// the default "a user can only update their own row" policy won't
// cover an admin editing someone else's profile.

// marketplace.user_role enum (confirmed via pg_enum) — exact labels,
// nothing else is valid.
const ROLES = [
  "buyer", "seller", "agent", "admin", "lawyer", "valuer",
  "surveyor", "bank", "landlord", "property_manager", "tenant",
];

const ROLE_LABEL = {
  buyer: "Buyer",
  seller: "Seller",
  agent: "Agent",
  admin: "Admin",
  lawyer: "Lawyer",
  valuer: "Valuer",
  surveyor: "Surveyor",
  bank: "Bank",
  landlord: "Landlord",
  property_manager: "Property manager",
  tenant: "Tenant",
};

const PAGE_LIMIT = 300;

const PROFILE_SELECT =
  "id, full_name, phone, email, role, avatar_url, created_at, updated_at, country, agency_name, license_number, rating_avg, rating_count, is_suspended, suspended_at, suspended_reason";

const SORTS = [
  { key: "newest", label: "Newest joined" },
  { key: "oldest", label: "Oldest joined" },
  { key: "name", label: "Name A–Z" },
];

function initials(name) {
  if (!name) return "?";
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

function Avatar({ name, url, size = 36 }) {
  if (url) {
    return <img className="user-avatar" src={url} alt={name} style={{ width: size, height: size }} />;
  }
  return (
    <div className="user-avatar user-avatar-fallback" style={{ width: size, height: size }}>
      {initials(name)}
    </div>
  );
}

function RoleTag({ role }) {
  return (
    <span className={`role-tag${role === "admin" ? " role-tag--admin" : ""}`}>
      {ROLE_LABEL[role] ?? role}
    </span>
  );
}

export default function AdminUsers() {
  const { user: adminUser } = useAuth();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [suspendedOnly, setSuspendedOnly] = useState(false);
  const [sort, setSort] = useState("newest");

  const [toast, setToast] = useState(null);

  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [suspendReason, setSuspendReason] = useState("");

  const [detailLoading, setDetailLoading] = useState(false);
  const [activity, setActivity] = useState(null);
  const [conversations, setConversations] = useState([]);

  const selectedUser = useMemo(
    () => users.find((u) => u.id === selectedId) ?? null,
    [users, selectedId]
  );

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    const { data, error } = await mp()
      .from("profiles")
      .select(PROFILE_SELECT)
      .order("created_at", { ascending: false })
      .limit(PAGE_LIMIT);

    if (error) {
      console.error("Failed loading profiles:", error.message);
      setLoadError(error.message);
      setLoading(false);
      return;
    }

    setUsers(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  // Scoped, per-user queries — fetched only when a drawer is opened,
  // never for the whole roster at once (querying messages/views/etc.
  // for every user up front wouldn't scale as the platform grows).
  const loadDetail = useCallback(async (userId) => {
    setDetailLoading(true);

    const [msgRes, viewRes, vrRes, txRes, listingsRes, convRes] = await Promise.all([
      mp().from("messages").select("created_at", { count: "exact" }).eq("sender_id", userId).order("created_at", { ascending: false }).limit(1),
      mp().from("listing_views").select("viewed_at", { count: "exact" }).eq("viewer_id", userId).order("viewed_at", { ascending: false }).limit(1),
      mp().from("viewing_requests").select("requested_at", { count: "exact" }).eq("buyer_id", userId).order("requested_at", { ascending: false }).limit(1),
      mp().from("transactions").select("created_at", { count: "exact" }).or(`buyer_id.eq.${userId},agent_id.eq.${userId},seller_id.eq.${userId}`).order("created_at", { ascending: false }).limit(1),
      mp().from("listings").select("id", { count: "exact", head: true }).or(`seller_id.eq.${userId},agent_id.eq.${userId}`),
      // conversations has TWO FKs into profiles (participant_one,
      // participant_two) — same ambiguity as agent_profiles elsewhere,
      // so each embed is aliased (p1 / p2) rather than left as `profiles`.
      mp()
        .from("conversations")
        .select(
          "id, listing_id, last_message, last_message_at, created_at, participant_one, participant_two, p1:profiles!participant_one(full_name, avatar_url), p2:profiles!participant_two(full_name, avatar_url), listing:listings(title)"
        )
        .or(`participant_one.eq.${userId},participant_two.eq.${userId}`)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(20),
    ]);

    [
      ["messages", msgRes], ["listing_views", viewRes], ["viewing_requests", vrRes],
      ["transactions", txRes], ["listings", listingsRes], ["conversations", convRes],
    ].forEach(([label, res]) => {
      if (res.error) console.error(`Failed loading ${label} for user detail:`, res.error.message);
    });

    const timestamps = [
      msgRes.data?.[0]?.created_at,
      viewRes.data?.[0]?.viewed_at,
      vrRes.data?.[0]?.requested_at,
      txRes.data?.[0]?.created_at,
    ].filter(Boolean);

    const lastActive = timestamps.length
      ? timestamps.reduce((latest, t) => (new Date(t) > new Date(latest) ? t : latest))
      : null;

    setActivity({
      messages: msgRes.count ?? 0,
      views: viewRes.count ?? 0,
      viewings: vrRes.count ?? 0,
      purchases: txRes.count ?? 0,
      listingsPosted: listingsRes.count ?? 0,
      lastActive,
    });

    setConversations(
      (convRes.data ?? []).map((c) => {
        const other = c.participant_one === userId ? c.p2 : c.p1;
        return {
          id: c.id,
          otherName: other?.full_name ?? "Unknown user",
          otherAvatar: other?.avatar_url ?? null,
          listingTitle: c.listing?.title ?? null,
          lastMessage: c.last_message,
          lastMessageAt: c.last_message_at ?? c.created_at,
        };
      })
    );

    setDetailLoading(false);
  }, []);

  function openUser(user) {
    setSelectedId(user.id);
    setDraft({
      full_name: user.full_name ?? "",
      phone: user.phone ?? "",
      email: user.email ?? "",
      role: user.role,
    });
    setSaveError(null);
    setSuspendReason("");
    setActivity(null);
    setConversations([]);
    loadDetail(user.id);
  }

  function closeDrawer() {
    setSelectedId(null);
    setDraft(null);
  }

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") closeDrawer();
    }
    if (selectedId) window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedId]);

  async function handleSaveProfile() {
    if (!selectedUser || !draft) return;
    setSaving(true);
    setSaveError(null);

    const roleChanged = draft.role !== selectedUser.role;

    const { error } = await mp()
      .from("profiles")
      .update({
        full_name: draft.full_name,
        phone: draft.phone || null,
        email: draft.email,
        role: draft.role,
      })
      .eq("id", selectedUser.id);

    if (error) {
      console.error("Failed to update profile:", error.message);
      setSaveError(error.message);
      setSaving(false);
      return;
    }

    if (roleChanged) {
      const { error: auditError } = await mp().from("admin_actions").insert({
        admin_id: adminUser?.id,
        action: `change_role_to_${draft.role}`,
        target_table: "profiles",
        target_id: selectedUser.id,
      });
      if (auditError) console.error("Failed to log admin action:", auditError.message);
    }

    setUsers((prev) => prev.map((u) => (u.id === selectedUser.id ? { ...u, ...draft } : u)));
    setSaving(false);
    setToast("Profile updated");
  }

  async function handleToggleSuspend() {
    if (!selectedUser) return;
    const suspending = !selectedUser.is_suspended;
    setSaving(true);
    setSaveError(null);

    const patch = {
      is_suspended: suspending,
      suspended_at: suspending ? new Date().toISOString() : null,
      suspended_reason: suspending ? suspendReason || null : null,
    };

    const { error } = await mp().from("profiles").update(patch).eq("id", selectedUser.id);

    if (error) {
      console.error("Failed to update suspension state:", error.message);
      setSaveError(error.message);
      setSaving(false);
      return;
    }

    const { error: auditError } = await mp().from("admin_actions").insert({
      admin_id: adminUser?.id,
      action: suspending ? "suspend_user" : "reactivate_user",
      target_table: "profiles",
      target_id: selectedUser.id,
    });
    if (auditError) console.error("Failed to log admin action:", auditError.message);

    setUsers((prev) => prev.map((u) => (u.id === selectedUser.id ? { ...u, ...patch } : u)));
    setSaving(false);
    setSuspendReason("");
    setToast(suspending ? "User suspended" : "User reactivated");
  }

  const visible = useMemo(() => {
    let rows = users;

    if (roleFilter !== "all") rows = rows.filter((u) => u.role === roleFilter);
    if (suspendedOnly) rows = rows.filter((u) => u.is_suspended);

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(
        (u) =>
          u.full_name?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q) ||
          u.phone?.toLowerCase().includes(q)
      );
    }

    const sorted = [...rows];
    switch (sort) {
      case "oldest":
        sorted.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        break;
      case "name":
        sorted.sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? ""));
        break;
      default:
        sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
    return sorted;
  }, [users, roleFilter, suspendedOnly, search, sort]);

  return (
    <div>
      <h2 className="section-heading">Users</h2>

      <div className="user-controls">
        <div className="user-search-wrap">
          <Search size={15} />
          <input
            type="text"
            className="user-search"
            placeholder="Search by name, email, or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select className="user-select" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="all">All roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>{ROLE_LABEL[r]}</option>
          ))}
        </select>

        <select className="user-select" value={sort} onChange={(e) => setSort(e.target.value)}>
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>

        <button
          type="button"
          className={`filter-chip${suspendedOnly ? " is-active" : ""}`}
          onClick={() => setSuspendedOnly((v) => !v)}
        >
          Suspended only
        </button>
      </div>

      {loadError && <div className="user-error">Couldn't load users — {loadError}</div>}
      {loading && <div className="user-loading">Loading users…</div>}

      {!loading && !loadError && visible.length === 0 && (
        <div className="empty-note">No users match this filter.</div>
      )}

      {!loading && visible.length > 0 && (
        <div className="user-table" role="table">
          <div className="user-table-head" role="row">
            <span>User</span>
            <span>Role</span>
            <span>Country</span>
            <span>Joined</span>
            <span></span>
          </div>

          {visible.map((u) => (
            <button
              type="button"
              key={u.id}
              className="user-row"
              role="row"
              onClick={() => openUser(u)}
            >
              <span className="user-row-cell user-row-identity" data-label="User">
                <Avatar name={u.full_name} url={u.avatar_url} />
                <span className="user-row-identity-text">
                  <span className="user-row-name">
                    {u.full_name}
                    {u.is_suspended && <span className="suspended-tag">Suspended</span>}
                  </span>
                  <span className="user-row-email">{u.email}</span>
                </span>
              </span>
              <span className="user-row-cell" data-label="Role"><RoleTag role={u.role} /></span>
              <span className="user-row-cell" data-label="Country">{u.country ?? "—"}</span>
              <span className="user-row-cell user-row-mono" data-label="Joined">{timeAgo(u.created_at)}</span>
              <span className="user-row-cell user-row-chevron" aria-hidden>›</span>
            </button>
          ))}
        </div>
      )}

      {toast && <div className="office-toast">{toast}</div>}

      {selectedUser && draft && (
        <>
          <div className="user-drawer-backdrop" onClick={closeDrawer} />
          <div className="user-drawer" role="dialog" aria-modal="true">
            <button type="button" className="user-drawer-close" onClick={closeDrawer} aria-label="Close">
              <X size={18} />
            </button>

            <div className="user-drawer-header">
              <Avatar name={selectedUser.full_name} url={selectedUser.avatar_url} size={56} />
              <div>
                <h3 className="user-drawer-name">{selectedUser.full_name}</h3>
                <p className="user-drawer-email">{selectedUser.email}</p>
                <div className="user-drawer-tags">
                  <RoleTag role={selectedUser.role} />
                  {selectedUser.is_suspended && (
                    <span className="suspended-stamp">
                      <ShieldAlert size={13} /> Suspended
                    </span>
                  )}
                </div>
              </div>
            </div>

            {selectedUser.is_suspended && selectedUser.suspended_reason && (
              <p className="user-drawer-suspend-reason">
                Reason: {selectedUser.suspended_reason}
              </p>
            )}

            <section className="user-drawer-section">
              <span className="user-drawer-eyebrow">Profile</span>

              <label className="user-field">
                <span>Full name</span>
                <input
                  type="text"
                  value={draft.full_name}
                  onChange={(e) => setDraft({ ...draft, full_name: e.target.value })}
                />
              </label>

              <label className="user-field">
                <span>Phone</span>
                <input
                  type="text"
                  value={draft.phone}
                  onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                />
              </label>

              <label className="user-field">
                <span>Email</span>
                <input
                  type="email"
                  value={draft.email}
                  onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                />
                <span className="user-field-hint">
                  This only updates their marketplace.profiles record — it does not change their
                  Supabase Auth login email.
                </span>
              </label>

              <label className="user-field">
                <span>Role</span>
                <select
                  value={draft.role}
                  onChange={(e) => setDraft({ ...draft, role: e.target.value })}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                  ))}
                </select>
              </label>

              {saveError && <p className="user-save-error">{saveError}</p>}

              <button
                type="button"
                className="btn btn-primary user-save-btn"
                onClick={handleSaveProfile}
                disabled={saving}
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </section>

            <section className="user-drawer-section">
              <span className="user-drawer-eyebrow">Account</span>
              <p className="user-drawer-meta">Joined {timeAgo(selectedUser.created_at)}</p>
              <p className="user-drawer-meta">Profile last updated {timeAgo(selectedUser.updated_at)}</p>

              {!selectedUser.is_suspended && (
                <textarea
                  className="user-suspend-reason-input"
                  placeholder="Reason for suspension (optional)"
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                />
              )}

              <button
                type="button"
                className={`btn ${selectedUser.is_suspended ? "btn-primary" : "btn-secondary"} user-suspend-btn`}
                onClick={handleToggleSuspend}
                disabled={saving}
              >
                {selectedUser.is_suspended ? "Reactivate account" : "Suspend account"}
              </button>
            </section>

            <section className="user-drawer-section">
              <span className="user-drawer-eyebrow">Activity</span>
              {detailLoading && (
                <p className="user-drawer-loading"><Loader2 size={14} className="user-drawer-spinner" /> Loading…</p>
              )}
              {!detailLoading && activity && (
                <>
                  <div className="user-activity-grid">
                    <span className="user-activity-stat"><MessageSquare size={14} />{activity.messages} messages sent</span>
                    <span className="user-activity-stat"><Eye size={14} />{activity.views} listing views</span>
                    <span className="user-activity-stat"><CalendarClock size={14} />{activity.viewings} viewing requests</span>
                    <span className="user-activity-stat"><Handshake size={14} />{activity.purchases} purchases involved in</span>
                    {activity.listingsPosted > 0 && (
                      <span className="user-activity-stat"><Building2 size={14} />{activity.listingsPosted} listings posted</span>
                    )}
                  </div>
                  <p className="user-drawer-meta">
                    Last activity: {activity.lastActive ? timeAgo(activity.lastActive) : "no recorded activity yet"}
                  </p>
                </>
              )}
            </section>

            <section className="user-drawer-section">
              <span className="user-drawer-eyebrow">Conversations</span>
              {detailLoading && <p className="user-drawer-loading">Loading…</p>}
              {!detailLoading && conversations.length === 0 && (
                <p className="user-drawer-meta">No conversations yet.</p>
              )}
              {!detailLoading && conversations.length > 0 && (
                <div className="user-conversation-list">
                  {conversations.map((c) => (
                    <div key={c.id} className="user-conversation-row">
                      <Avatar name={c.otherName} url={c.otherAvatar} size={30} />
                      <div className="user-conversation-body">
                        <span className="user-conversation-name">
                          {c.otherName}
                          {c.listingTitle && <span className="user-conversation-listing"> · {c.listingTitle}</span>}
                        </span>
                        {c.lastMessage && <span className="user-conversation-preview">{c.lastMessage}</span>}
                      </div>
                      <span className="user-conversation-time">{timeAgo(c.lastMessageAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}