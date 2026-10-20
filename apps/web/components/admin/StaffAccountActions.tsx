"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ChangePasswordModal } from "@/components/admin/ChangePasswordModal";
import { Icon } from "@/components/ui/Icon";
import { clearAuth } from "@/lib/auth";
import { logout } from "@/lib/staffApi";

/** "Password" + "Sign out" buttons shared by the staff pages. */
export function StaffAccountActions() {
  const router = useRouter();
  const [passwordOpen, setPasswordOpen] = useState(false);
  return (
    <>
      <button className="btn btn-secondary btn-sm" type="button" onClick={() => setPasswordOpen(true)}>
        <Icon name="lock" size={16} />
        Password
      </button>
      <button
        className="btn btn-secondary btn-sm"
        type="button"
        onClick={async () => {
          await logout();
          clearAuth();
          router.push("/login");
        }}
      >
        <Icon name="logout" size={16} />
        Sign out
      </button>
      {passwordOpen ? <ChangePasswordModal onClose={() => setPasswordOpen(false)} /> : null}
    </>
  );
}
