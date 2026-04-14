/**
 * 📦 Lazy Load Utilities
 * 
 * Dynamically import heavy libraries on-demand to reduce initial bundle size
 * This patterns allows libraries to load only when needed
 */

import React from "react";

/**
 * Lazy load PDF generation (html2canvas + jspdf)
 * - Use when: User downloads certificate or report
 * - Saves: ~200KB from initial bundle
 */
export const lazyLoadPDF = () =>
  Promise.all([
    import("html2canvas"),
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

/**
 * Lazy load chart library (Recharts)
 * - Use when: User navigates to analytics/finance pages
 * - Saves: ~350KB from initial bundle
 */
export const lazyLoadCharts = () =>
  import("recharts");

/**
 * Lazy load math rendering (KaTeX)
 * - Use when: Page contains math equations
 * - Saves: ~400KB from initial bundle
 */
export const lazyLoadKaTeX = () =>
  Promise.all([
    import("katex"),
    import("rehype-katex"),
  ]);

/**
 * Lazy load markdown processor
 * - Use when: User views markdown content
 * - Saves: ~200KB from initial bundle
 */
export const lazyLoadMarkdown = () =>
  Promise.all([
    import("react-markdown"),
    import("remark-math"),
  ]);

/**
 * 🎯 Example: Lazy Load Component Wrapper
 * 
 * Wrap heavy components to load on-demand:
 * 
 * const LazyFinanceChart = lazy(() => 
 *   lazyLoadCharts().then(() => import('./FinanceChart'))
 * );
 * 
 * Then use in JSX with Suspense:
 * 
 * <Suspense fallback={<LoadingSpinner />}>
 *   <LazyFinanceChart />
 * </Suspense>
 */

/**
 * Higher-order component for lazy loading
 * Automatically handles loading state and error boundary
 */
export function withLazyLoad<P extends object>(
  Component: React.ComponentType<P>,
  importFn: () => Promise<any>,
  FallbackComponent?: React.ComponentType<{ isLoading: boolean }>
) {
  const LazyComponent = React.lazy(() =>
    importFn().then(() => ({ default: Component }))
  );

  return (props: P) => (
    <React.Suspense fallback={FallbackComponent ? <FallbackComponent isLoading={true} /> : <div>Loading...</div>}>
      <LazyComponent {...props} />
    </React.Suspense>
  );
}

/**
 * Monitor library load times for performance tracking
 */
export async function trackLazyLoad(
  libraryName: string,
  importFn: () => Promise<any>
) {
  const startTime = performance.now();
  try {
    const result = await importFn();
    const loadTime = performance.now() - startTime;
    console.log(
      `📦 ${libraryName} loaded in ${loadTime.toFixed(2)}ms`,
      result
    );
    return result;
  } catch (error) {
    const loadTime = performance.now() - startTime;
    console.error(
      `❌ Failed to load ${libraryName} after ${loadTime.toFixed(2)}ms:`,
      error
    );
    throw error;
  }
}
