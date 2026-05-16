import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, CategoryInput } from '../../services/api';

export const CategorySettings: React.FC = () => {
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setShowAddForm(false);
      setNewCategoryName('');
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
      if (editingCategoryId === id) {
        setEditingCategoryId(null);
        setEditingCategoryName('');
      }
    },
  });

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

  return (
    <div className="stack-col">
      <h3 style={{ fontSize: '1.1em', marginBottom: 8 }}>分类管理</h3>
      
      {categories.length > 0 && (
        <div className="stack-col" style={{ gap: 8, marginTop: 8 }}>
          {categories.map((category) => (
            <div key={category.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: 'var(--surface-soft)', borderRadius: 'var(--radius-sm)' }}>
              {editingCategoryId === category.id ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
                  <input
                    type="color"
                    value={editingCategoryColor}
                    onChange={(e) => setEditingCategoryColor(e.target.value)}
                    style={{ width: 28, height: 28, padding: 0, border: 0, background: 'transparent', flexShrink: 0 }}
                  />
                  <input
                    type="text"
                    className="input"
                    value={editingCategoryName}
                    onChange={(e) => setEditingCategoryName(e.target.value)}
                    placeholder="分类名称"
                    style={{ flex: 1 }}
                    autoFocus
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                    <span style={{ backgroundColor: category.color, width: 12, height: 12, borderRadius: '50%', display: 'inline-block' }} />
                    <span style={{ fontWeight: 600 }}>{category.name}</span>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => beginEditCategory(category.id, category.name, category.color)}
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
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
        </div>
      )}

      {!showAddForm ? (
        <button type="button" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start', marginTop: 12 }} onClick={() => setShowAddForm(true)}>
          + 新建分类
        </button>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: 'var(--surface-soft)', borderRadius: 'var(--radius-sm)', marginTop: 12 }}>
          <input
            type="color"
            value={newCategoryColor}
            onChange={(e) => setNewCategoryColor(e.target.value)}
            style={{ width: 28, height: 28, padding: 0, border: 0, background: 'transparent', flexShrink: 0 }}
          />
          <input
            type="text"
            placeholder="分类名称"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            autoFocus
            className="input"
            style={{ flex: 1 }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              disabled={!newCategoryName.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate({ name: newCategoryName.trim(), color: newCategoryColor })}
              className="btn btn-primary btn-sm"
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
  );
};

