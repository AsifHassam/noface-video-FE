import { Character } from "@/types";

const avatar = (name: string) => `/avatars/${name.toLowerCase().replace(/\s+/g, "-")}.png`;

export const CHARACTERS: Character[] = [
  {
    id: "hero1",
    slug: "hero-1",
    name: "Peter",
    avatarUrl: "/avatars/peter.png",
    enabled: true,
    isPlaceholder: true,
  },
  {
    id: "hero2",
    slug: "hero-2",
    name: "Stewie",
    avatarUrl: "/avatars/stewie.png",
    enabled: true,
    isPlaceholder: true,
  },
  {
    id: "stewie-like",
    slug: "stewie-like",
    name: "Stewie-like",
    avatarUrl: avatar("stewie"),
    enabled: false,
    isPlaceholder: false,
  },
  {
    id: "peter-like",
    slug: "peter-like",
    name: "Peter-like",
    avatarUrl: avatar("peter"),
    enabled: false,
    isPlaceholder: false,
  },
  {
    id: "rick-like",
    slug: "rick-like",
    name: "Rick",
    avatarUrl: "/avatars/rick.png",
    enabled: true,
    isPlaceholder: false,
  },
  {
    id: "brian-like",
    slug: "brian-like",
    name: "Brian",
    avatarUrl: "/avatars/brian.png",
    enabled: true,
    isPlaceholder: false,
  },
  {
    id: "morty-like",
    slug: "morty-like",
    name: "Morty",
    avatarUrl: "/avatars/morty.png",
    enabled: true,
    isPlaceholder: false,
  },
];
