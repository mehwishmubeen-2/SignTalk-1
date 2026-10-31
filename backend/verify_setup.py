#!/usr/bin/env python
"""
Verify that all PyTorch sign recognition components are properly set up.
Run this before starting the backend server.
"""

import sys
from pathlib import Path

def check_file(path, description):
    """Check if a file exists."""
    p = Path(path)
    if p.exists():
        size = p.stat().st_size / (1024 * 1024)  # MB
        print(f"  ✅ {description}: {path} ({size:.1f} MB)")
        return True
    else:
        print(f"  ❌ {description}: NOT FOUND - {path}")
        return False

def check_import(module_name):
    """Check if a Python module can be imported."""
    try:
        __import__(module_name)
        print(f"  ✅ {module_name}")
        return True
    except ImportError as e:
        print(f"  ❌ {module_name}: {e}")
        return False

def main():
    print("\n" + "="*60)
    print("PyTorch SignNet Video Calling - Setup Verification")
    print("="*60 + "\n")
    
    all_ok = True
    
    # Check files
    print("1️⃣  Checking Training Files...")
    all_ok &= check_file("common.py", "Training architecture")
    all_ok &= check_file("extract.py", "Feature extraction")
    all_ok &= check_file("app/SignRecognition/classes.txt", "Sign classes")
    
    print("\n2️⃣  Checking Model Files...")
    for i in range(5):
        all_ok &= check_file(f"app/SignRecognition/best_{i}.pt", f"Model {i}")
    
    print("\n3️⃣  Checking Python Imports...")
    all_ok &= check_import("torch")
    all_ok &= check_import("mediapipe")
    all_ok &= check_import("cv2")
    all_ok &= check_import("fastapi")
    all_ok &= check_import("numpy")
    
    print("\n4️⃣  Checking Application Code...")
    try:
        sys.path.insert(0, str(Path.cwd()))
        from common import SignNet, prep, classes
        print(f"  ✅ SignNet architecture loaded")
        print(f"  ✅ prep() function available")
        print(f"  ✅ {len(classes)} sign classes: {', '.join(classes[:3])}...")
        
        from app.services.pytorch_sign_recognizer import SignRecognizer
        print(f"  ✅ SignRecognizer service")
        
        from app.services.pytorch_video_handler import PyTorchVideoStreamHandler
        print(f"  ✅ PyTorchVideoStreamHandler")
        
        from app.VideoCall.router_pytorch import router
        print(f"  ✅ router_pytorch router")
    except Exception as e:
        print(f"  ❌ Import error: {e}")
        all_ok = False
    
    print("\n5️⃣  Checking Model Loading...")
    try:
        from common import SignNet
        import torch
        from pathlib import Path
        
        model_dir = Path("app/SignRecognition")
        model_files = sorted(model_dir.glob("best_*.pt"))
        
        if len(model_files) != 5:
            print(f"  ❌ Expected 5 models, found {len(model_files)}")
            all_ok = False
        
        for mf in model_files:
            model = SignNet()
            state = torch.load(str(mf), map_location='cpu')
            model.load_state_dict(state)
            model.eval()
            print(f"  ✅ {mf.name} loads and evaluates correctly")
    
    except Exception as e:
        print(f"  ❌ Model loading failed: {e}")
        all_ok = False
    
    print("\n6️⃣  System Information...")
    import torch
    print(f"  🔧 PyTorch device: {'CUDA (GPU)' if torch.cuda.is_available() else 'CPU'}")
    print(f"  🔧 Python version: {sys.version.split()[0]}")
    
    print("\n" + "="*60)
    if all_ok:
        print("✅ SETUP VERIFICATION PASSED!")
        print("\nYou can now start the backend server:")
        print("  python main.py")
        print("\nThen test the health endpoint:")
        print("  curl http://localhost:8000/meetings/health")
        return 0
    else:
        print("❌ SETUP VERIFICATION FAILED!")
        print("\nFix the issues above before starting the server.")
        return 1

if __name__ == "__main__":
    sys.exit(main())
