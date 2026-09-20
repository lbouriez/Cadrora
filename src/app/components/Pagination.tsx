import type { MouseEvent } from 'react';

/** Accessible numbered pagination. Example: <Pagination label={t('pages')} currentPage={page} pageCount={count} onPageChange={setPage} />. */
export interface PaginationProps {
  currentPage: number;
  label: string;
  nextLabel: string;
  onPageChange: (page: number) => void;
  pageCount: number;
  previousLabel: string;
}

function preventNavigation(event: MouseEvent<HTMLButtonElement>) {
  event.preventDefault();
}

export function Pagination({ currentPage, label, nextLabel, onPageChange, pageCount, previousLabel }: PaginationProps) {
  if (pageCount <= 1) return null;

  const pages = Array.from({ length: pageCount }, (_, index) => index + 1);
  const firstPage = 1;
  const lastPage = pages.at(-1) ?? firstPage;
  const activePage = Math.min(Math.max(currentPage, firstPage), lastPage);

  return (
    <nav aria-label={label} className="pagination">
      <button
        aria-label={previousLabel}
        className="pagination__button"
        disabled={activePage === firstPage}
        onClick={(event) => {
          preventNavigation(event);
          onPageChange(activePage - 1);
        }}
        type="button"
      >
        ‹
      </button>
      {pages.map((page) => (
        <button
          aria-current={page === activePage ? 'page' : undefined}
          aria-label={`${label} ${page}`}
          className="pagination__button"
          key={page}
          onClick={(event) => {
            preventNavigation(event);
            onPageChange(page);
          }}
          type="button"
        >
          {page}
        </button>
      ))}
      <button
        aria-label={nextLabel}
        className="pagination__button"
        disabled={activePage === lastPage}
        onClick={(event) => {
          preventNavigation(event);
          onPageChange(activePage + 1);
        }}
        type="button"
      >
        ›
      </button>
    </nav>
  );
}
