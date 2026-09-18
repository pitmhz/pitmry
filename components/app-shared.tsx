"use client";

import type { ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  DashboardSquare01Icon,
  GitBranchIcon,
  MessageQuestionIcon,
  Settings01Icon,
  ComputerTerminalIcon,
} from "@hugeicons/core-free-icons";

export type SidebarNavItem = {
  title: string;
  path?: string;
  icon?: ReactNode;
  isActive?: boolean;
  subItems?: SidebarNavItem[];
};

export type SidebarNavGroup = {
  label: string;
  items: SidebarNavItem[];
};

export const navGroups: SidebarNavGroup[] = [
  {
    label: "Memory",
    items: [
      {
        title: "Stream",
        path: "#stream",
        icon: <HugeiconsIcon icon={DashboardSquare01Icon} strokeWidth={1.5} />,
        isActive: true,
      },
    ],
  },
  {
    label: "Types",
    items: [
      {
        title: "Decisions",
        path: "#decisions",
        icon: <HugeiconsIcon icon={Settings01Icon} strokeWidth={1.5} />,
      },
      {
        title: "Commits",
        path: "#commits",
        icon: <HugeiconsIcon icon={GitBranchIcon} strokeWidth={1.5} />,
      },
      {
        title: "Discussions",
        path: "#discussions",
        icon: <HugeiconsIcon icon={MessageQuestionIcon} strokeWidth={1.5} />,
      },
    ],
  },
];

export const footerNavLinks: SidebarNavItem[] = [
  {
    title: "RTK",
    path: "#rtk",
    icon: <HugeiconsIcon icon={ComputerTerminalIcon} strokeWidth={1.5} />,
  },
];

export const navLinks: SidebarNavItem[] = [
  ...navGroups.flatMap((group) =>
    group.items.flatMap((item) =>
      item.subItems?.length ? [item, ...item.subItems] : [item]
    )
  ),
  ...footerNavLinks,
];
