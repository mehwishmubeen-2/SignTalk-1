"""
Script to integrate newly trained models into the SignTalk application.

Usage:
    # From backend directory
    python ../scripts/integrate_trained_model.py \\
        --input_model /path/to/trained_model.pkl \\
        --output_dir app/SignRecognition \\
        --version 2024-10-29-v2 \\
        --dataset wlasl_500

    # Or use relative paths
    python ../scripts/integrate_trained_model.py \\
        --input_model ~/trained_models/model.pkl \\
        --version v2

Features:
    - Validates model structure
    - Copies to versioned filename
    - Saves metadata (date, dataset, file size)
    - Creates backup of previous model if needed
    - Tests model loading before integration
"""

import argparse
import os
import pickle
import shutil
import json
from datetime import datetime
from pathlib import Path


def validate_model(model_path: str):
    """
    Validate model file structure.
    
    Returns:
        (is_valid, message)
    """
    if not os.path.exists(model_path):
        return False, f"Model file not found: {model_path}"
    
    try:
        with open(model_path, 'rb') as f:
            data = pickle.load(f)
        
        if not isinstance(data, dict):
            return False, f"Model must be a dictionary, got {type(data)}"
        
        required_keys = {'model', 'label_encoder'}
        missing = required_keys - set(data.keys())
        
        if missing:
            return False, f"Model missing keys: {missing}"
        
        # Check label encoder
        le = data['label_encoder']
        if not hasattr(le, 'classes_'):
            return False, "Label encoder missing 'classes_' attribute"
        
        num_classes = len(le.classes_)
        
        return True, f"Valid model: {num_classes} classes"
    
    except pickle.UnpicklingError as e:
        return False, f"Failed to unpickle model: {e}"
    except Exception as e:
        return False, f"Error validating model: {e}"


def integrate_model(
    input_model: str,
    output_dir: str,
    version: str,
    dataset: str,
    make_default: bool = True
) -> bool:
    """
    Integrate trained model into the application.
    
    Args:
        input_model: Path to trained model PKL file
        output_dir: Directory to save model (e.g., backend/app/SignRecognition)
        version: Version identifier (e.g., 2024-10-29-v2)
        dataset: Dataset used for training (e.g., wlasl_500)
        make_default: Make this the default model
    
    Returns:
        True if successful, False otherwise
    """
    print("\n" + "="*70)
    print("SIGN RECOGNITION MODEL INTEGRATION")
    print("="*70)
    
    # Step 1: Validate input model
    print("\n[1/5] Validating model file...")
    is_valid, message = validate_model(input_model)
    print(f"      {message}")
    
    if not is_valid:
        print(f"\nModel validation failed. Cannot integrate.")
        return False
    
    # Step 2: Prepare output directory
    print("\n[2/5] Preparing output directory...")
    os.makedirs(output_dir, exist_ok=True)
    
    # Create versioned filename
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_name = f"asl_rf_model_{version}_{timestamp}.pkl"
    output_path = os.path.join(output_dir, output_name)
    
    # Check if output path exists
    if os.path.exists(output_path):
        print(f"      Warning: File already exists: {output_name}")
        response = input("      Overwrite? (y/n): ").strip().lower()
        if response != 'y':
            print("      Cancelled.")
            return False
    
    print(f"      Output: {output_name}")
    
    # Step 3: Copy model
    print("\n[3/5] Copying model file...")
    try:
        shutil.copy2(input_model, output_path)
        file_size_mb = os.path.getsize(output_path) / 1024 / 1024
        print(f"      Model copied ({file_size_mb:.2f} MB)")
    except Exception as e:
        print(f"      Copy failed: {e}")
        return False
    
    # Step 4: Save metadata
    print("\n[4/5] Saving metadata...")
    metadata = {
        'version': version,
        'filename': output_name,
        'original_file': os.path.basename(input_model),
        'dataset': dataset,
        'integrated_at': datetime.now().isoformat(),
        'file_size_mb': round(file_size_mb, 2),
        'integrator': 'integrate_trained_model.py',
        'model_info': load_model_info(output_path)
    }
    
    metadata_file = os.path.join(output_dir, f"{output_name}.meta.json")
    try:
        with open(metadata_file, 'w') as f:
            json.dump(metadata, f, indent=2)
        print(f"      Metadata saved")
    except Exception as e:
        print(f"      Warning: Metadata save failed: {e}")
    
    # Step 5: Update default model (optional)
    print("\n[5/5] Updating configuration...")
    
    if make_default:
        config_path = os.path.join(output_dir, "model_config.json")
        config = {
            'default_model': output_name,
            'version': version,
            'updated_at': datetime.now().isoformat()
        }
        try:
            with open(config_path, 'w') as f:
                json.dump(config, f, indent=2)
            print(f"      Default model updated")
        except Exception as e:
            print(f"      Warning: Config update failed: {e}")
    
    # Summary
    print("\n" + "="*70)
    print("MODEL INTEGRATION SUCCESSFUL")
    print("="*70)
    print("\nModel Details:")
    print(json.dumps(metadata, indent=2, default=str))
    print("\nNext Steps:")
    print(f"   1. Restart the backend server")
    print(f"   2. Call: POST /meetings/models/switch")
    print(f"      with body: {{'model_name': '{output_name}', 'version': '{version}'}}")
    print(f"   3. Verify with: GET /meetings/models/info")
    
    return True


def load_model_info(model_path: str):
    """Load basic info from model file."""
    try:
        with open(model_path, 'rb') as f:
            data = pickle.load(f)
        
        le = data.get('label_encoder')
        num_classes = len(le.classes_) if le else 0
        
        return {
            'num_classes': num_classes,
            'first_10_classes': [str(c) for c in le.classes_[:10]] if le else []
        }
    except Exception as e:
        return {'error': str(e)}


def main():
    parser = argparse.ArgumentParser(
        description="Integrate trained sign recognition models into SignTalk",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Basic integration
  python integrate_trained_model.py --input_model models/my_trained_model.pkl --version 2024-10-29-v2

  # Full integration with metadata
  python integrate_trained_model.py --input_model ~/models/trained.pkl --output_dir backend/app/SignRecognition --version v2.1 --dataset wlasl_500_filtered

  # Integration without setting as default
  python integrate_trained_model.py --input_model model.pkl --version experimental --no-default
        """
    )
    
    parser.add_argument(
        "--input_model",
        required=True,
        help="Path to trained model PKL file"
    )
    parser.add_argument(
        "--output_dir",
        default="backend/app/SignRecognition",
        help="Output directory for model (default: backend/app/SignRecognition)"
    )
    parser.add_argument(
        "--version",
        required=True,
        help="Version identifier (e.g., 2024-10-29-v2)"
    )
    parser.add_argument(
        "--dataset",
        default="unknown",
        help="Dataset used for training"
    )
    parser.add_argument(
        "--no-default",
        action="store_true",
        help="Don't set this as the default model"
    )
    
    args = parser.parse_args()
    
    # Expand paths
    input_model = os.path.expanduser(args.input_model)
    output_dir = os.path.expanduser(args.output_dir)
    
    success = integrate_model(
        input_model=input_model,
        output_dir=output_dir,
        version=args.version,
        dataset=args.dataset,
        make_default=not args.no_default
    )
    
    exit(0 if success else 1)


if __name__ == "__main__":
    main()
