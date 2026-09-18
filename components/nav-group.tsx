import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	SidebarGroup,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import type { SidebarNavGroup } from "@/components/app-shared";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";

export function NavGroup({ label, items }: SidebarNavGroup) {
	return (
		<SidebarGroup>
			{label && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
			<SidebarMenu>
				{items.map((item) => (
					<Collapsible className="group/collapsible" defaultOpen={
                    							!!item.isActive ||
                    							item.subItems?.some((i) => !!i.isActive)
                    						} key={item.title} render={<SidebarMenuItem />}>{item.subItems?.length ? (
                    								<>
                    									<CollapsibleTrigger render={<SidebarMenuButton isActive={item.isActive} />}>{item.icon}<span>{item.title}</span><HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" /></CollapsibleTrigger>
                    									<CollapsibleContent>
                    										<SidebarMenuSub>
                    											{item.subItems?.map((subItem) => (
                    												<SidebarMenuSubItem key={subItem.title}>
                    													<SidebarMenuSubButton isActive={subItem.isActive} render={<a href={subItem.path} />}>{subItem.icon}<span>{subItem.title}</span></SidebarMenuSubButton>
                    												</SidebarMenuSubItem>
                    											))}
                    										</SidebarMenuSub>
                    									</CollapsibleContent>
                    								</>
                    							) : (
                    								<SidebarMenuButton isActive={item.isActive} render={<a href={item.path} />}>{item.icon}<span>{item.title}</span></SidebarMenuButton>
                    							)}</Collapsible>
				))}
			</SidebarMenu>
		</SidebarGroup>
	);
}
