import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';

interface CategorySelectorProps {
  selectedCategoryId?: number;
  onSelect: (categoryId?: number) => void;
}

export const CategorySelector: React.FC<CategorySelectorProps> = ({
  selectedCategoryId,
  onSelect,
}) => {
  const selectorRef = useRef<HTMLDivElement | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.getCategories(),
  });

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);

  useEffect(() => {
    if (!showDropdown) {
      return;
    }

    const handleOutsidePointer = (event: MouseEvent | TouchEvent) => {
      if (!selectorRef.current || !(event.target instanceof Node)) {
        return;
      }

      if (selectorRef.current.contains(event.target)) {
        return;
      }

      setShowDropdown(false);
    };

    document.addEventListener('mousedown', handleOutsidePointer);
    document.addEventListener('touchstart', handleOutsidePointer);

    return () => {
      document.removeEventListener('mousedown', handleOutsidePointer);
      document.removeEventListener('touchstart', handleOutsidePointer);
    };
  }, [showDropdown]);

  return (
    <div className="category-selector" ref={selectorRef}>
      <button
        type="button"
        onClick={() => setShowDropdown(!showDropdown)}
        className="category-trigger"
        style={
          selectedCategory
            ? { backgroundColor: selectedCategory.color, borderStyle: 'solid', color: '#ffffff' }
            : undefined
        }
      >
        {selectedCategory ? selectedCategory.name : '分类'}
      </button>

      {showDropdown && (
        <div className="category-dropdown">
          {categories.length > 0 && (
            <div style={{ marginBottom: '8px' }}>
              <div className="category-list-wrap">
                {categories.map((category) => (
                  <div key={category.id} className="category-row">
                    <button
                      type="button"
                      className="category-item category-item-inline category-title-btn"
                      style={
                        selectedCategoryId === category.id
                          ? { backgroundColor: 'var(--surface-soft)' }
                          : undefined
                      }
                      onClick={() => {
                        onSelect(category.id);
                        setShowDropdown(false);
                      }}
                    >
                      <span className="category-dot" style={{ backgroundColor: category.color }} />
                      <span>{category.name}</span>
                    </button>
                  </div>
                ))}

                <div className="category-row">
                  <button
                    type="button"
                    className="category-item category-item-inline category-title-btn muted"
                    onClick={() => {
                      onSelect(undefined);
                      setShowDropdown(false);
                    }}
                  >
                    未分类
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
