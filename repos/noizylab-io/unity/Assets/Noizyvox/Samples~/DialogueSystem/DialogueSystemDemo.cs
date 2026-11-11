using System.Threading.Tasks;
using UnityEngine;
using UnityEngine.UI;
using Noizyvox.Unity;

namespace Noizyvox.Samples
{
    /// <summary>
    /// Dialogue system demo with subtitles
    /// </summary>
    public class DialogueSystemDemo : MonoBehaviour
    {
        [Header("Components")]
        [SerializeField] private NoizyvoxDialogue dialogue;
        
        [Header("UI")]
        [SerializeField] private Text characterNameText;
        [SerializeField] private Text subtitleText;
        [SerializeField] private GameObject dialoguePanel;
        [SerializeField] private Button skipButton;
        [SerializeField] private Button startButton;
        
        [Header("Settings")]
        [SerializeField] private float fadeInDuration = 0.3f;
        [SerializeField] private float fadeOutDuration = 0.3f;
        
        private CanvasGroup _panelCanvasGroup;
        
        private void Awake()
        {
            _panelCanvasGroup = dialoguePanel.GetComponent<CanvasGroup>();
            if (_panelCanvasGroup == null)
            {
                _panelCanvasGroup = dialoguePanel.AddComponent<CanvasGroup>();
            }
            
            // Setup button listeners
            if (skipButton != null)
                skipButton.onClick.AddListener(OnSkipClicked);
                
            if (startButton != null)
                startButton.onClick.AddListener(OnStartClicked);
            
            // Subscribe to dialogue events
            dialogue.OnLineStarted += OnLineStarted;
            dialogue.OnLineComplete += OnLineComplete;
            dialogue.OnDialogueComplete += OnDialogueComplete;
            
            // Hide panel initially
            dialoguePanel.SetActive(false);
        }
        
        private async void OnStartClicked()
        {
            startButton.gameObject.SetActive(false);
            await StartDialogueAsync();
        }
        
        private void OnSkipClicked()
        {
            dialogue.Skip();
        }
        
        public async Task StartDialogueAsync()
        {
            // Show panel with fade
            dialoguePanel.SetActive(true);
            await FadePanel(0f, 1f, fadeInDuration);
            
            // Play dialogue
            await dialogue.PlayDialogueAsync();
        }
        
        private void OnLineStarted(DialogueLine line)
        {
            // Update UI
            if (characterNameText != null)
                characterNameText.text = line.CharacterName;
                
            if (subtitleText != null)
                subtitleText.text = line.Text;
            
            // Trigger animation if specified
            if (!string.IsNullOrEmpty(line.AnimationTrigger))
            {
                // Find character animator and trigger animation
                Debug.Log($"[DialogueDemo] Animation trigger: {line.AnimationTrigger}");
            }
        }
        
        private void OnLineComplete(DialogueLine line)
        {
            Debug.Log($"[DialogueDemo] Line complete: {line.Id}");
        }
        
        private async void OnDialogueComplete()
        {
            Debug.Log("[DialogueDemo] Dialogue complete");
            
            // Fade out panel
            await FadePanel(1f, 0f, fadeOutDuration);
            dialoguePanel.SetActive(false);
            
            // Show start button again
            if (startButton != null)
                startButton.gameObject.SetActive(true);
        }
        
        private async Task FadePanel(float from, float to, float duration)
        {
            float elapsed = 0f;
            _panelCanvasGroup.alpha = from;
            
            while (elapsed < duration)
            {
                elapsed += Time.deltaTime;
                _panelCanvasGroup.alpha = Mathf.Lerp(from, to, elapsed / duration);
                await Task.Yield();
            }
            
            _panelCanvasGroup.alpha = to;
        }
        
        private void OnDestroy()
        {
            if (dialogue != null)
            {
                dialogue.OnLineStarted -= OnLineStarted;
                dialogue.OnLineComplete -= OnLineComplete;
                dialogue.OnDialogueComplete -= OnDialogueComplete;
            }
        }
    }
}
