import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Modal } from './Modal';

describe('Modal Component', () => {
  it('does not render into DOM when isOpen is false', () => {
    render(
      <Modal isOpen={false} onClose={vi.fn()} title="Hidden Modal">
        <p>Modal content</p>
      </Modal>
    );
    expect(screen.queryByText('Hidden Modal')).not.toBeInTheDocument();
    expect(screen.queryByText('Modal content')).not.toBeInTheDocument();
  });

  it('renders title and children when isOpen is true', () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="Test Modal Title">
        <p>Modal body test content</p>
      </Modal>
    );
    expect(screen.getByText('Test Modal Title')).toBeInTheDocument();
    expect(screen.getByText('Modal body test content')).toBeInTheDocument();
  });

  it('calls onClose when clicking the close (X) button', () => {
    const handleClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={handleClose} title="Closeable Modal">
        <p>Content</p>
      </Modal>
    );
    const closeBtn = screen.getByRole('button');
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when pressing the Escape key', () => {
    const handleClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={handleClose} title="Escape Modal">
        <p>Content</p>
      </Modal>
    );
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when pressing other keys', () => {
    const handleClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={handleClose} title="Key Modal">
        <p>Content</p>
      </Modal>
    );
    fireEvent.keyDown(window, { key: 'Enter', code: 'Enter' });
    expect(handleClose).not.toHaveBeenCalled();
  });

  it('applies custom maxWidth class', () => {
    const { container } = render(
      <Modal isOpen={true} onClose={vi.fn()} title="Wide Modal" maxWidth="max-w-4xl">
        <p>Content</p>
      </Modal>
    );
    const dialogBox = container.querySelector('.max-w-4xl');
    expect(dialogBox).toBeInTheDocument();
  });

  it('sets document.body.style.overflow to hidden when open and restores on unmount', () => {
    const { unmount } = render(
      <Modal isOpen={true} onClose={vi.fn()} title="Body Lock Modal">
        <p>Content</p>
      </Modal>
    );
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('unset');
  });
});
