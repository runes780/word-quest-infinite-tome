'use client';

import { useRef, useState, useEffect, useCallback, ReactNode } from 'react';

interface VirtualListProps<T> {
    items: T[];
    itemHeight: number;
    containerHeight: number;
    renderItem: (item: T, index: number) => ReactNode;
    overscan?: number;
    className?: string;
}

/**
 * VirtualList - Efficient rendering of large lists
 * Only renders items visible in the viewport + overscan buffer
 * 
 * @param items - Array of data items
 * @param itemHeight - Fixed height of each item in pixels
 * @param containerHeight - Height of the scrollable container
 * @param renderItem - Function to render each item
 * @param overscan - Number of extra items to render above/below viewport (default: 3)
 */
export function VirtualList<T>({
    items,
    itemHeight,
    containerHeight,
    renderItem,
    overscan = 3,
    className = ''
}: VirtualListProps<T>) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [scrollTop, setScrollTop] = useState(0);

    // Calculate visible range
    const totalHeight = items.length * itemHeight;
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
        items.length,
        Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );

    const visibleItems = items.slice(startIndex, endIndex);
    const offsetY = startIndex * itemHeight;

    // Handle scroll
    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        setScrollTop(e.currentTarget.scrollTop);
    }, []);

    // Scroll to item by index
    const scrollToIndex = useCallback((index: number) => {
        if (containerRef.current) {
            containerRef.current.scrollTop = index * itemHeight;
        }
    }, [itemHeight]);

    return (
        <div
            ref={containerRef}
            className={`overflow-auto ${className}`}
            style={{ height: containerHeight, position: 'relative' }}
            onScroll={handleScroll}
        >
            {/* Spacer to maintain scroll height */}
            <div style={{ height: totalHeight, position: 'relative' }}>
                {/* Visible items positioned absolutely */}
                <div style={{ transform: `translateY(${offsetY}px)` }}>
                    {visibleItems.map((item, i) => (
                        <div
                            key={startIndex + i}
                            style={{ height: itemHeight }}
                        >
                            {renderItem(item, startIndex + i)}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

/**
 * Hook for dynamic item heights (more complex use case)
 * For fixed heights, use VirtualList directly
 */
export function useVirtualScroll<T>({
    items,
    estimatedItemHeight,
    containerHeight,
    overscan = 3
}: {
    items: T[];
    estimatedItemHeight: number;
    containerHeight: number;
    overscan?: number;
}) {
    const [scrollTop, setScrollTop] = useState(0);
    const itemHeights = useRef<Map<number, number>>(new Map());

    // Calculate positions based on measured heights
    const getItemOffset = (index: number): number => {
        let offset = 0;
        for (let i = 0; i < index; i++) {
            offset += itemHeights.current.get(i) ?? estimatedItemHeight;
        }
        return offset;
    };

    const getTotalHeight = (): number => {
        let total = 0;
        for (let i = 0; i < items.length; i++) {
            total += itemHeights.current.get(i) ?? estimatedItemHeight;
        }
        return total;
    };

    // Find visible range
    const findVisibleRange = (): { start: number; end: number } => {
        let start = 0;
        let accumulated = 0;

        // Find start
        for (let i = 0; i < items.length; i++) {
            const height = itemHeights.current.get(i) ?? estimatedItemHeight;
            if (accumulated + height > scrollTop) {
                start = Math.max(0, i - overscan);
                break;
            }
            accumulated += height;
        }

        // Find end
        let end = start;
        accumulated = getItemOffset(start);
        for (let i = start; i < items.length; i++) {
            const height = itemHeights.current.get(i) ?? estimatedItemHeight;
            if (accumulated > scrollTop + containerHeight) {
                end = Math.min(items.length, i + overscan);
                break;
            }
            accumulated += height;
            end = i + 1;
        }

        return { start, end: Math.min(items.length, end + overscan) };
    };

    const { start, end } = findVisibleRange();

    const measureItem = (index: number, height: number) => {
        if (itemHeights.current.get(index) !== height) {
            itemHeights.current.set(index, height);
        }
    };

    return {
        visibleItems: items.slice(start, end),
        startIndex: start,
        endIndex: end,
        totalHeight: getTotalHeight(),
        offsetY: getItemOffset(start),
        setScrollTop,
        measureItem
    };
}
