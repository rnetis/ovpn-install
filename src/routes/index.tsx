import { createFileRoute } from "@tanstack/react-router";
import { GatehouseApp } from "@/components/gatehouse/app";

export const Route = createFileRoute("/")({ component: GatehouseApp });
