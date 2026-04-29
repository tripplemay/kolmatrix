"use client";

/**
 * BM1-F003 · Client wrapper that owns the create-product modal state.
 *
 * Both the header "+ Add new product" button and the dashed empty-state
 * card in the grid open the same modal, so we need shared state between
 * them. This component renders the header action + the grid (cards +
 * empty-state card) + the modal, and re-fetches via router.refresh()
 * after a successful save (the server action already revalidates the
 * page cache; router.refresh nudges the Next.js app router to pick up
 * the fresh render).
 */
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deleteProduct } from "./actions";
import { ProductCard } from "./ProductCard";
import { ProductModal } from "./ProductModal";
import type { ProductListItem } from "./types";

interface Props {
  products: ProductListItem[];
}

export function ProductsClient({ products }: Props) {
  const t = useTranslations("knowledgeBase");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProductListItem | null>(null);
  const [isDeleting, startDelete] = useTransition();

  const onCreated = () => {
    router.refresh();
    setEditing(null);
  };

  const onDelete = (product: ProductListItem) => {
    const confirmed = window.confirm(`Delete "${product.name}"?`);
    if (!confirmed) return;
    startDelete(async () => {
      const res = await deleteProduct(product.id);
      if (!res.ok) {
        window.alert("Could not delete product. Please retry.");
        return;
      }
      router.refresh();
    });
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="mb-1 text-2xl font-bold tracking-tight text-white">
            {t("title")}
          </h1>
          <p className="text-sm text-on-surface-variant">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            disabled
            title={t("importCsvDisabled")}
            className="flex cursor-not-allowed items-center gap-2 rounded-xl bg-surface-high px-5 py-2.5 text-sm font-semibold text-on-surface-variant opacity-50"
          >
            <span className="material-symbols-outlined text-lg" aria-hidden>
              upload_file
            </span>
            {t("importCsv")}
          </button>
          <button
            type="button"
            onClick={() => setOpen(true)}
            data-testid="kb-add-product"
            className="gradient-cta flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-bold text-on-primary"
          >
            <span className="material-symbols-outlined text-lg" aria-hidden>
              add
            </span>
            {t("addButton")}
          </button>
        </div>
      </div>

      <div
        className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
        data-testid="kb-grid"
      >
        {products.map((p) => (
          <ProductCard
            key={p.id}
            product={p}
            onEdit={(item) => {
              setEditing(item);
              setOpen(true);
            }}
            onDelete={onDelete}
          />
        ))}
        <button
          type="button"
          onClick={() => setOpen(true)}
          data-testid="kb-empty-card"
          className="group flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-outline-variant/30 p-6 text-on-surface-variant transition-all hover:border-cyan/40 hover:bg-cyan/5"
        >
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-surface-high transition-transform group-hover:scale-110">
            <span className="material-symbols-outlined text-3xl" aria-hidden>
              add
            </span>
          </div>
          <p className="text-sm font-semibold">{t("emptyCardLabel")}</p>
        </button>
      </div>

      {open ? (
        <ProductModal
          onClose={() => {
            setOpen(false);
            setEditing(null);
          }}
          onCreated={onCreated}
          product={editing ?? undefined}
        />
      ) : null}
      {isDeleting ? <span className="sr-only">Deleting</span> : null}
    </>
  );
}
