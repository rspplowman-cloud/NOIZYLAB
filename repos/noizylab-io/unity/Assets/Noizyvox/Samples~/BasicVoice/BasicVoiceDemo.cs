using UnityEngine;
using Noizyvox.Unity;

namespace Noizyvox.Samples
{
    /// <summary>
    /// Basic voice synthesis demo
    /// </summary>
    [RequireComponent(typeof(NoizyvoxVoice))]
    public class BasicVoiceDemo : MonoBehaviour
    {
        [Header("Demo Settings")]
        [SerializeField] private string[] testPhrases = new string[]
        {
            "Hello, adventurer! Welcome to our village.",
            "The dragon has been spotted near the mountain pass.",
            "You have proven yourself worthy of this quest.",
            "Beware the shadows, for they hide many dangers.",
            "May the light guide your path, brave hero."
        };
        
        [SerializeField] private KeyCode speakKey = KeyCode.Space;
        [SerializeField] private KeyCode stopKey = KeyCode.Escape;
        
        private NoizyvoxVoice _voice;
        private int _phraseIndex;
        
        private void Awake()
        {
            _voice = GetComponent<NoizyvoxVoice>();
            
            // Subscribe to events
            _voice.OnSynthesisComplete += OnSynthesisComplete;
            _voice.OnSynthesisError += OnSynthesisError;
            _voice.OnPlaybackStarted += OnPlaybackStarted;
            _voice.OnPlaybackComplete += OnPlaybackComplete;
        }
        
        private void Update()
        {
            if (Input.GetKeyDown(speakKey))
            {
                SpeakNextPhrase();
            }
            
            if (Input.GetKeyDown(stopKey))
            {
                _voice.Stop();
            }
        }
        
        private void SpeakNextPhrase()
        {
            string phrase = testPhrases[_phraseIndex % testPhrases.Length];
            _phraseIndex++;
            
            Debug.Log($"[BasicVoiceDemo] Speaking: {phrase}");
            _voice.Speak(phrase);
        }
        
        private void OnSynthesisComplete(SynthesisResult result)
        {
            Debug.Log($"[BasicVoiceDemo] Synthesis complete - Duration: {result.DurationSeconds}s, Characters: {result.CharactersUsed}, Cached: {result.FromCache}");
        }
        
        private void OnSynthesisError(string error)
        {
            Debug.LogError($"[BasicVoiceDemo] Error: {error}");
        }
        
        private void OnPlaybackStarted()
        {
            Debug.Log("[BasicVoiceDemo] Playback started");
        }
        
        private void OnPlaybackComplete()
        {
            Debug.Log("[BasicVoiceDemo] Playback complete");
        }
        
        private void OnDestroy()
        {
            if (_voice != null)
            {
                _voice.OnSynthesisComplete -= OnSynthesisComplete;
                _voice.OnSynthesisError -= OnSynthesisError;
                _voice.OnPlaybackStarted -= OnPlaybackStarted;
                _voice.OnPlaybackComplete -= OnPlaybackComplete;
            }
        }
    }
}
