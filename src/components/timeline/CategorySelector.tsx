import React, { useEffect, useRef, useState } from 'react';
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
  const selectorRef = useRef<HTMLDivElement | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('#0d9488');

  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [editingCategoryColor, setEditingCategoryColor] = useState('#0d9488');

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

  const updateMutation = useMutation({
    mutationFn: ({ id, category }: { id: number; category: CategoryInput }) => api.updateCategory(id, category),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setEditingCategoryId(null);
      setEditingCategoryName('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteCategory(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      if (selectedCategoryId === id) {
        onSelect(undefined);
      }
      if (editingCategoryId === id) {
        setEditingCategoryId(null);
        setEditingCategoryName('');
      }
    },
  });

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);

  const beginEditCategory = (id: number, name: string, color: string) => {
    setEditingCategoryId(id);
    setEditingCategoryName(name);
    setEditingCategoryColor(color);
  };

  const submitEditCategory = () => {
    if (!editingCategoryId || !editingCategoryName.trim()) {
      return;
    }

    updateMutation.mutate({
      id: editingCategoryId,
      category: {
        name: editingCategoryName.trim(),
        color: editingCategoryColor,
      },
    });
  };

  const handleDeleteCategory = (id: number, name: string) => {
    const confirmed = window.confirm(`删除分类“${name}”？\n已使用该分类的条目会变为未分类。`);
    if (!confirmed) {
      return;
    }
    deleteMutation.mutate(id);
  };

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
      setShowAddForm(false);
      setEditingCategoryId(null);
      setEditingCategoryName('');
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
                    {editingCategoryId === category.id ? (
                      <div className="stack-col category-edit-panel">
                        <input
                          type="text"
                          className="input"
                          value={editingCategoryName}
                          onChange={(e) => setEditingCategoryName(e.target.value)}
                          placeholder="分类名称"
                          autoFocus
                        />
                        <div className="toolbar-row" style={{ width: '100%' }}>
                          <input
                            type="color"
                            value={editingCategoryColor}
                            onChange={(e) => setEditingCategoryColor(e.target.value)}
                            style={{ width: 36, height: 36, padding: 0, border: 0, background: 'transparent' }}
                          />
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            disabled={updateMutation.isPending || !editingCategoryName.trim()}
                            onClick={submitEditCategory}
                          >
                            保存
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setEditingCategoryId(null)}
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
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

                        <div className="toolbar-row category-actions-row">
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => beginEditCategory(category.id, category.name, category.color)}
                          >
                            编辑
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleDeleteCategory(category.id, category.name)}
                            disabled={deleteMutation.isPending}
                          >
                            删除
                          </button>
                        </div>
                      </>
                    )}
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
                  disabled={!newCategoryName.trim() || createMutation.isPending}
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

