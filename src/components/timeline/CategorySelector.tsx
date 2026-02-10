import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, CategoryInput } from '../../services/api';

interface CategorySelectorProps {
  selectedCategoryId?: number;
  onSelect: (categoryId?: number) => void;
}

export const CategorySelector: React.FC<CategorySelectorProps> = ({
  selectedCategoryId,
  onSelect,
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('#0d9488');

  const queryClient = useQueryClient();

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.getCategories(),
  });

  const createMutation = useMutation({
    mutationFn: (category: CategoryInput) => api.createCategory(category),
    onSuccess: (newCategory) => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      onSelect(newCategory.id);
      setShowAddForm(false);
      setNewCategoryName('');
      setShowDropdown(false);
    },
  });

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);

  return (
    <div className="category-selector">
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
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  className="category-item"
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
              ))}
              <button
                type="button"
                className="category-item muted"
                onClick={() => {
                  onSelect(undefined);
                  setShowDropdown(false);
                }}
              >
                不分类
              </button>
              <hr style={{ margin: '8px 0', border: 0, borderTop: '1px solid var(--border)' }} />
            </div>
          )}

          {!showAddForm ? (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowAddForm(true)}>
               + 新建分类
              </button>
          ) : (
            <div className="stack-col">
              <input
                type="text"
                placeholder="分类名称"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                autoFocus
                className="input"
              />
              <div className="toolbar-row">
                <input
                  type="color"
                  value={newCategoryColor}
                  onChange={(e) => setNewCategoryColor(e.target.value)}
                  style={{ width: 36, height: 36, padding: 0, border: 0, background: 'transparent' }}
                />
                <button
                  type="button"
                  disabled={!newCategoryName.trim()}
                  onClick={() => createMutation.mutate({ name: newCategoryName.trim(), color: newCategoryColor })}
                  className="btn btn-primary btn-sm"
                  style={{ flex: 1 }}
                >
                  添加
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowAddForm(false)}>
                  取消
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
