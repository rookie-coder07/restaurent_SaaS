import { useEffect, useMemo, useState } from 'react';

function getIsMobile() {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.matchMedia('(max-width: 767px)').matches;
}

export default function useResponsivePagination(items, {
  mobileItemsPerPage = 6,
  desktopItemsPerPage = 0,
  scrollOnPageChange = true,
} = {}) {
  const [isMobile, setIsMobile] = useState(getIsMobile);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const handleChange = (event) => setIsMobile(event.matches);

    setIsMobile(mediaQuery.matches);

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  const itemsPerPage = isMobile ? mobileItemsPerPage : 0;
  const totalItems = items.length;
  const totalPages = itemsPerPage > 0 ? Math.max(1, Math.ceil(totalItems / itemsPerPage)) : 1;

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [isMobile]);

  useEffect(() => {
    if (!scrollOnPageChange || currentPage === 1 || typeof window === 'undefined') {
      return;
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage, scrollOnPageChange]);

  const pageStart = itemsPerPage > 0 ? (currentPage - 1) * itemsPerPage : 0;
  const pageEnd = itemsPerPage > 0 ? pageStart + itemsPerPage : totalItems;

  const paginatedItems = useMemo(
    () => (itemsPerPage > 0 ? items.slice(pageStart, pageEnd) : items),
    [items, itemsPerPage, pageStart, pageEnd]
  );

  return {
    currentPage,
    setCurrentPage,
    totalPages,
    isMobile,
    itemsPerPage,
    totalItems,
    pageStart,
    paginatedItems,
    hasPagination: totalPages > 1,
    canGoPrevious: currentPage > 1,
    canGoNext: currentPage < totalPages,
    goPrevious: () => setCurrentPage((page) => Math.max(1, page - 1)),
    goNext: () => setCurrentPage((page) => Math.min(totalPages, page + 1)),
  };
}
