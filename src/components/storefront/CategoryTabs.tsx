"use client";

import { useEffect, useState } from "react";

/**
 * Tabs de categorías sticky con resaltado de la sección visible
 * (como el menú digital de OlaClick).
 */
export default function CategoryTabs({
  categories,
}: {
  categories: { id: string; name: string }[];
}) {
  const [activeId, setActiveId] = useState(categories[0]?.id ?? "");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        // Toma la sección visible más cercana al tope.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) {
          setActiveId(visible[0].target.id.replace("cat-", ""));
        }
      },
      { rootMargin: "-96px 0px -60% 0px" },
    );
    for (const category of categories) {
      const el = document.getElementById(`cat-${category.id}`);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [categories]);

  useEffect(() => {
    // Mantiene visible el tab activo dentro de la barra horizontal.
    document
      .getElementById(`tab-${activeId}`)
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeId]);

  return (
    <nav
      aria-label="Categorías"
      className="sticky top-0 z-10 -mx-4 flex gap-1 overflow-x-auto border-b border-gray-100 bg-white px-4"
    >
      {categories.map((category) => {
        const active = category.id === activeId;
        return (
          <a
            key={category.id}
            id={`tab-${category.id}`}
            href={`#cat-${category.id}`}
            className={`whitespace-nowrap border-b-2 px-3 py-3 text-sm transition-colors ${
              active
                ? "border-gray-900 font-semibold text-gray-900"
                : "border-transparent font-medium text-gray-600 hover:text-gray-900"
            }`}
          >
            {category.name}
          </a>
        );
      })}
    </nav>
  );
}
