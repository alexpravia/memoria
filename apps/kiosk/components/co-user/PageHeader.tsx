"use client";

import Link from "next/link";
import Icon from "@/components/Icon";

interface Props {
  title: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  action?: React.ReactNode;
}

export function PageHeader({
  title,
  subtitle,
  backHref = "/co-user",
  backLabel = "Dashboard",
  action,
}: Props) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 16,
        marginBottom: 32,
      }}
    >
      <div>
        <Link
          href={backHref}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            color: "var(--color-primary-soft)",
            textDecoration: "none",
            fontSize: "var(--type-sm)",
            marginBottom: 8,
          }}
        >
          <Icon name="back" size={16} color="var(--color-primary-soft)" />
          {backLabel}
        </Link>
        <h1
          style={{
            fontSize: "var(--type-greeting)",
            fontWeight: "var(--type-weight-bold)",
            color: "var(--color-fg-strong)",
            margin: 0,
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            style={{
              color: "var(--color-fg-muted)",
              fontSize: "var(--type-md)",
              margin: "6px 0 0",
            }}
          >
            {subtitle}
          </p>
        )}
      </div>

      {action && <div style={{ flexShrink: 0, paddingTop: 28 }}>{action}</div>}
    </div>
  );
}
