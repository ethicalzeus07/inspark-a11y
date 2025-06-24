// popup-handlers.js - Modal handlers (separate file for CSP compliance)

document.addEventListener('DOMContentLoaded', () => {
  const backBtn = document.getElementById('backBtn');
  const issueDetail = document.getElementById('issueDetail');
  const resultsContainer = document.getElementById('resultsContainer');
  const closeDetail = document.getElementById('closeDetail');
  const modalBackdrop = document.getElementById('modalBackdrop');

  function closeModal() {
    issueDetail.classList.add('hidden');
    resultsContainer.classList.remove('hidden');
  }

  // Back button functionality
  if (backBtn) {
    backBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeModal();
    });
  }

  // Close button functionality
  if (closeDetail) {
    closeDetail.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeModal();
    });
  }

  // Backdrop click to close
  if (modalBackdrop) {
    modalBackdrop.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeModal();
    });
  }

  // Prevent closing when clicking inside modal content
  const modalContent = document.querySelector('.modal-content');
  if (modalContent) {
    modalContent.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  // Escape key to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !issueDetail.classList.contains('hidden')) {
      closeModal();
    }
  });

  console.log('🎭 Modal handlers loaded');
});