/* tslint:disable:no-bitwise */
import since = require("jasmine2-custom-message");

import { Encoding } from "./encoding";
import { Secp256k1 } from "./secp256k1";

const toHex = Encoding.toHex;
const fromHex = Encoding.fromHex;

describe("Secp256k1", () => {
  // How to generate Secp256k1 test vectors:
  // $ git clone https://github.com/pyca/cryptography.git && cd cryptography
  // $ python2 -m virtualenv venv
  // $ source venv/bin/activate
  // $ pip install cryptography cryptography_vectors pytest ecdsa
  // $ curl https://patch-diff.githubusercontent.com/raw/webmaster128/cryptography/pull/1.diff | git apply
  //
  // optionally normalize signatures to lowS representation:
  // $ curl https://patch-diff.githubusercontent.com/raw/webmaster128/cryptography/pull/2.diff | git apply
  //
  // $ python ./docs/development/custom-vectors/secp256k1/generate_secp256k1.py > secp256k1_test_vectors.txt

  it("can load private keys", done => {
    (async () => {
      expect(await Secp256k1.makeKeypair(fromHex("5eaf4344dab73d0caee1fd03607bb969074fb217f076896c2125f8607feab7b1"))).toBeTruthy();
      expect(await Secp256k1.makeKeypair(fromHex("f7ac570ea2844e29e7f3b3c6a724ee1f47d3de8c2175a69abae94ae871573d0e"))).toBeTruthy();
      expect(await Secp256k1.makeKeypair(fromHex("e4ade2a5232a7c6f37e7b854a774e25e6047ee7c6d63e8304ae04fa190bc1732"))).toBeTruthy();

      // smallest and largest allowed values: 1 and N-1 (from https://crypto.stackexchange.com/a/30273)
      expect(await Secp256k1.makeKeypair(fromHex("0000000000000000000000000000000000000000000000000000000000000001"))).toBeTruthy();
      expect(await Secp256k1.makeKeypair(fromHex("FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364140"))).toBeTruthy();

      // too short and too long
      await Secp256k1.makeKeypair(fromHex("e4ade2a5232a7c6f37e7b854a774e25e6047ee7c6d63e8304ae04fa190bc17"))
        .then(() => {
          fail("promise must be rejected");
        })
        .catch(error => {
          expect(error.message).toContain("not a valid secp256k1 private key");
        });
      await Secp256k1.makeKeypair(fromHex("e4ade2a5232a7c6f37e7b854a774e25e6047ee7c6d63e8304ae04fa190bc1732aa"))
        .then(() => {
          fail("promise must be rejected");
        })
        .catch(error => {
          expect(error.message).toContain("not a valid secp256k1 private key");
        });
      // value out of range (too small)
      await Secp256k1.makeKeypair(fromHex("0000000000000000000000000000000000000000000000000000000000000000"))
        .then(() => {
          fail("promise must be rejected");
        })
        .catch(error => {
          expect(error.message).toContain("not a valid secp256k1 private key");
        });
      // value out of range (>= n)
      await Secp256k1.makeKeypair(fromHex("ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"))
        .then(() => {
          fail("promise must be rejected");
        })
        .catch(error => {
          expect(error.message).toContain("not a valid secp256k1 private key");
        });
      await Secp256k1.makeKeypair(fromHex("FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141"))
        .then(() => {
          fail("promise must be rejected");
        })
        .catch(error => {
          expect(error.message).toContain("not a valid secp256k1 private key");
        });

      done();
    })().catch(error => {
      setTimeout(() => {
        throw error;
      });
    });
  });

  it("creates signatures", done => {
    (async () => {
      const privkey = fromHex("43a9c17ccbb0e767ea29ce1f10813afde5f1e0a7a504e89b4d2cc2b952b8e0b9");
      const keypair = await Secp256k1.makeKeypair(privkey);
      const message = new Uint8Array([0x11, 0x22]);
      const signature = await Secp256k1.createSignature(message, keypair.privkey);
      expect(signature).toBeTruthy();
      expect(signature.byteLength).toBeGreaterThanOrEqual(70);
      expect(signature.byteLength).toBeLessThanOrEqual(72);

      done();
    })().catch(error => {
      setTimeout(() => {
        throw error;
      });
    });
  });

  it("creates signatures deterministically", done => {
    (async () => {
      const privkey = fromHex("43a9c17ccbb0e767ea29ce1f10813afde5f1e0a7a504e89b4d2cc2b952b8e0b9");
      const keypair = await Secp256k1.makeKeypair(privkey);
      const message = new Uint8Array([0x11, 0x22]);

      const signature1 = await Secp256k1.createSignature(message, keypair.privkey);
      const signature2 = await Secp256k1.createSignature(message, keypair.privkey);
      expect(signature1).toEqual(signature2);

      done();
    })().catch(error => {
      setTimeout(() => {
        throw error;
      });
    });
  });

  it("verifies signatures", done => {
    (async () => {
      const privkey = fromHex("43a9c17ccbb0e767ea29ce1f10813afde5f1e0a7a504e89b4d2cc2b952b8e0b9");
      const keypair = await Secp256k1.makeKeypair(privkey);
      const message = new Uint8Array([0x11, 0x22]);
      const signature = await Secp256k1.createSignature(message, keypair.privkey);

      {
        // valid
        const ok = await Secp256k1.verifySignature(signature, message, keypair.pubkey);
        expect(ok).toEqual(true);
      }

      {
        // message corrupted
        const corruptedMessage = message.map((x, i) => (i === 0 ? x ^ 0x01 : x));
        const ok = await Secp256k1.verifySignature(signature, corruptedMessage, keypair.pubkey);
        expect(ok).toEqual(false);
      }

      {
        // signature corrupted
        const corruptedSignature = signature.map((x, i) => (i === 0 ? x ^ 0x01 : x));
        const ok = await Secp256k1.verifySignature(corruptedSignature, message, keypair.pubkey);
        expect(ok).toEqual(false);
      }

      {
        // wrong pubkey
        const otherPrivkey = fromHex("91099374790843e29552c3cfa5e9286d6c77e00a2c109aaf3d0a307081314a09");
        const wrongPubkey = (await Secp256k1.makeKeypair(otherPrivkey)).pubkey;
        const ok = await Secp256k1.verifySignature(signature, message, wrongPubkey);
        expect(ok).toEqual(false);
      }

      done();
    })().catch(error => {
      setTimeout(() => {
        throw error;
      });
    });
  });

  it("verifies unnormalized pyca/cryptography signatures", done => {
    (async () => {
      // signatures are mixed lowS and non-lowS
      const data: ReadonlyArray<any> = [
        {
          message: fromHex("5c868fedb8026979ebd26f1ba07c27eedf4ff6d10443505a96ecaf21ba8c4f0937b3cd23ffdc3dd429d4cd1905fb8dbcceeff1350020e18b58d2ba70887baa3a9b783ad30d3fbf210331cdd7df8d77defa398cdacdfc2e359c7ba4cae46bb74401deb417f8b912a1aa966aeeba9c39c7dd22479ae2b30719dca2f2206c5eb4b7"),
          privkey: fromHex("21142a7e90031ea750c9fa1ba1beae16782386be438133bd43195826ae2e25f0"),
          signature: fromHex("30440220207082eb2c3dfa0b454e0906051270ba4074ac93760ba9e7110cd94714751111022051eb0dbbc9920e72146fb564f99d039802bf6ef2561446eb126ef364d21ee9c4"),
        },
        {
          message: fromHex("17cd4a74d724d55355b6fb2b0759ca095298e3fd1856b87ca1cb2df5409058022736d21be071d820b16dfc441be97fbcea5df787edc886e759475469e2128b22f26b82ca993be6695ab190e673285d561d3b6d42fcc1edd6d12db12dcda0823e9d6079e7bc5ff54cd452dad308d52a15ce9c7edd6ef3dad6a27becd8e001e80f"),
          privkey: fromHex("824282b6069fe3df857ce37204df4312c35750ee7a0f5e5fd8181666d5e46fb2"),
          signature: fromHex("30440220626d61b7be1488b563e8a85bfb623b2331903964b5c0476c9f9ad29144f076fe02202002a2c0ab5e48626bf761cf677dfeede9c7309d2436d4b8c2b89f21ee2ebc6a"),
        },
        {
          message: fromHex("db0d31717b04802adbbae1997487da8773440923c09b869e12a57c36dda34af11b8897f266cd81c02a762c6b74ea6aaf45aaa3c52867eb8f270f5092a36b498f88b65b2ebda24afe675da6f25379d1e194d093e7a2f66e450568dbdffebff97c4597a00c96a5be9ba26deefcca8761c1354429622c8db269d6a0ec0cc7a8585c"),
          privkey: fromHex("5c0da42cec87a6b7a173514965343c30013386c0fe9b39203ed7af43ea425944"),
          signature: fromHex("304602210083de9be443bcf480892b8c8ca1d5ee65c79a315642c3f7b5305aff3065fda2780221009747932122b93cec42cad8ee4630a8f6cbe127578b8c495b4ab927275f657658"),
        },
        {
          message: fromHex("47c9deddfd8c841a63a99be96e972e40fa035ae10d929babfc86c437b9d5d495577a45b7f8a35ce3f880e7d8ae8cd8eb685cf41f0506e68046ccf5559232c674abb9c3683829dcc8002683c4f4ca3a29a7bfde20d96dd0f1a0ead847dea18f297f220f94932536ca4deacedc2c6701c3ee50e28e358dcc54cdbf69daf0eb87f6"),
          privkey: fromHex("ab30a326599165b48c65ab8d3c77d312d7b2ea4853f721e18cc278628a866980"),
          signature: fromHex("30440220723da69da81c8f6b081a9a728b9bba785d2067e0ed769675f8a7563d22ed8a1602203a993793cf39b96b3cd625df0e06f206e17579cd8ebcb7e704174c3d94dba684"),
        },
        {
          message: fromHex("f15433188c2bbc93b2150bb2f34d36ba8ae49f8f7e4e81aed651c8fb2022b2a7e851c4dbbbc21c14e27380316bfdebb0a049246349537dba687581c1344e40f75afd2735bb21ea074861de6801d28b22e8beb76fdd25598812b2061ca3fba229daf59a4ab416704543b02e16b8136c22acc7e197748ae19b5cbbc160fdc3a8cd"),
          privkey: fromHex("1560b9fa5229f623a9c556132da4fc0e58633f39ce6421d25b5a6cde4ad7e019"),
          signature: fromHex("304502200e0c5228e6783bee4d0406f4f7b7d79f705f0dbb55126966f79e631bd8b23079022100faae33aec5b0fafd3413c14bfdef9c7c9ac6abd06c923c48ab136a2c56826118"),
        },
        {
          message: fromHex("1bc796124b87793b7f7fdd53b896f8f0d0f2d2be36d1944e3c2a0ac5c6b2839f59a4b4fad200f8035ec98630c51ef0d40863a5ddd69b703d73f06b4afae8ad1a88e19b1b26e8c10b7bff953c05eccc82fd771b220910165f3a906b7c931683e431998d1fd06c32dd11b4f872bf980d547942f22124c7e50c9523321aee23a36d"),
          privkey: fromHex("42f7d48e1c90f3d20252713f7c7c6ce8492c2b99bcef198927de334cda6bad00"),
          signature: fromHex("3046022100b9d3962edadc893f8eeff379f136c7b8fc6ea824a5afc6cbda7e3cb4c7a1e860022100bb1c1f901cf450edfdce20686352bb0cf0a643301123140ec87c92480d7f9d6a"),
        },
        {
          message: fromHex("18e55ac264031da435b613fc9dc6c4aafc49aae8ddf6f220d523415896ff915fae5c5b2e6aed61d88e5721823f089c46173afc5d9b47fd917834c85284f62dda6ed2d7a6ff10eb553b9312b05dad7decf7f73b69479c02f14ea0a2aa9e05ec07396cd37c28795c90e590631137102315635d702278e352aa41d0826adadff5e1"),
          privkey: fromHex("6fe5b986c18da5d4fbcea6f602f469ac039085247ccb97b6292992363ea1d21c"),
          signature: fromHex("30460221009369ab86afae5e22ed5f4012964804d2a19c36b8b58cf2855205b1cfcc937422022100a27dfc38d899b78edcf38a1b2b53578e72270b083d7d69424c4b4a7d25d39f4d"),
        },
        {
          message: fromHex("a5290666c97294d090f8da898e555cbd33990579e5e95498444bfb318b4aa1643e0d4348425e21c7c6f99f9955f3048f56c22b68c4a516af5c90ed5268acc9c5a20fec0200c2a282a90e20d3c46d4ecdda18ba18b803b19263de2b79238da921707a0864799cdee9f02913b40681c02c6923070688844b58fe415b7d71ea6845"),
          privkey: fromHex("fbf02ff086b215d057130a509346b64eb63bec0e38db692e07ad24c6ca8fe210"),
          signature: fromHex("3045022100c5e439cef76b28dc0fe9d260763bec05b5e795ac8d90b25d9fccbc1918bc32f302201b06144e6b191224d5eda822a5b3b2026af6aa7f25a9061c9e81c312728aa94a"),
        },
        {
          message: fromHex("13ad0600229c2a66b2f11617f69c7210ad044c49265dc98ec3c64f56e56a083234d277d404e2c40523c414ad23af5cc2f91a47fe59e7ca572f7fe1d3d3cfceaedadac4396749a292a38e92727273272335f12b2acea21cf069682e67d7e7d7a31ab5bb8e472298a9451aeae6f160f36e6623c9b632b9c93371a002818addc243"),
          privkey: fromHex("474a7dc7f5033b6bf5e3027254cd0dbd956f16f61874b2992839a867f607d0dd"),
          signature: fromHex("3045022100ee8615a5fab6fc674e6d3d9cde8da2b18dece076ae94d96662e16109db12d72002203171705cdab2b3d34c58e556c80358c105807e98243f5754b70b771071308b94"),
        },
        {
          message: fromHex("51ad843da5eafc177d49a50a82609555e52773c5dfa14d7c02db5879c11a6b6e2e0860df38452dc579d763f91a83ade23b73f4fcbd703f35dd6ecfbb4c9578d5b604ed809c8633e6ac5679a5f742ce94fea3b97b5ba8a29ea28101a7b35f9eaa894dda54e3431f2464d18faf8342b7c59dfe0598c0ab29a14622a08eea70126b"),
          privkey: fromHex("e8a2939a46e6bb7e706e419c0101d39f0494935b17fe3ca907b2ea3558d6ab3a"),
          signature: fromHex("3046022100f753c447161aa3a58e5deeca31797f21484fb0ec3a7fe6e464ab1914896f253b02210099640fbcce1f25fd66744b046e0dfd57fa23070555f438af6c5e5828d47e9fa7"),
        },
        {
          message: fromHex("678b505467d55ce01aec23fd4851957137c3a1de3ff2c673ec95a577aa9fb011b4b4a8eb7a0e6f391d4236a35b7e769692ace5851d7c53700e180fa522d3d37dbaa496163f3de6d96391e38ff83271e621f2458729ff74de462cdce6b3029f308d4eb8aef036357b9de06d68558e0388a6e88af91340c875050b8c91c4e26fc8"),
          privkey: fromHex("08ce8f7118eda55b008f6eb3281a445a3ddbc5209d5ac16c09dbf40fe4bbc22c"),
          signature: fromHex("30440220439fd0423bde36a1616a6fa4343bb7e07a6b3f6dc629aa8c93c91831055e476c022020998a26ae4b96ef36d48d83e8af0288f0bbc2db5ca5c8271a42f3fdc478fcb2"),
        },
        {
          message: fromHex("9bf457159f0d44b78d0e151ee53c41cecd98fb4e4129fcda8cc84a758636f84dcad9032f3ec422219d8a7ec61ea89f45d19cab3c3d451de1a634e3d2532231bc03031973d7150cf8e83d8b6a34f25fc136446878e3851b780abdca069c8e981b3ea3f1bf1ff6e47a03f97aed64c1cc90dd00389fa21bb973f142af5e8ceccef4"),
          privkey: fromHex("820be5c5e14e802300ca024fce318910f00470f6c3eabb12e7f3fac9383cf247"),
          signature: fromHex("304502204ce72a83cf1d148db4d1e46e2f773c677f72933c40d7100b9192750a1c8222a80221009d5fbd67ce89ba8c79df9dc3b42922026a8498921c2bdb4ea8f36496d88c2cfb"),
        },
        {
          message: fromHex("2469172b7a046e6112dfe365590dfddb7c045cccd4ab353edc3076091aad1c780a9a73ff93f3dbf9e2189c5d1fdd6f6167d0ae8cc0f53dc8950e60dd0410e23589999d4ce4fa49e268774defd4edce01c05b205014b63591a041745bfffc6ae4d72d3add353e49478106653cc735b07b0fe665c42d0e6766e525bb9718264c87"),
          privkey: fromHex("d92d6170e63bc33647e6dcdf1981771ecd57e11d47d73138696fbf49a430c3ab"),
          signature: fromHex("304502201f1e1fb673e9a7dee09961c6824b473189904deb4f0d8e28da51f77f4de2efe6022100ae8df1fcdb226fac8b46e494720e45f6d9a5350174faaf22e47b6329ee6c5e1b"),
        },
        {
          message: fromHex("6f8983e74f304c3657cffde0682b42699cb2c3475b925058ff37292c40a0aa296690ad129730339ac60cf784225b2fd3db58297c8ce5889df7a48d3e74a363ae4135e8a234cab53ca4c11c031d561a6cf7dd47b925ed5bc4c2794ba7b74a868b0c3da31ff1e4540d0768612192a236d86f74fb8c73f375b71c62f1648c0e6126"),
          privkey: fromHex("a70eb435feaeb6ccda7d3ebd3c4ae40b60643bc933f37ad1aca41dd086e8ae50"),
          signature: fromHex("30460221009cf7d941dcbbbe61c2a6f5112cb518094e79e5d203891de2247e75fd532c3f21022100fc5a04579b2526f2543efd2a57e82b647da08b6924bff39cf021398a56ad70de"),
        },
        {
          message: fromHex("6fbe6f0f178fdc8a3ad1a8eecb02d37108c5831281fe85e3ff8eeb66ca1082a217b6d602439948f828e140140412544f994da75b6efc203b295235deca060ecfc7b71f05e5af2acc564596772ddbfb4078b4665f6b85f4e70641af26e31f6a14e5c88604459df4eeeed9b77b33c4b82a3c1458bd2fd1dc7214c04f9c79c8f09b"),
          privkey: fromHex("34a677d6f0c132eeffc3451b61e5d55969399699019ac929e6fdb5215d37be5e"),
          signature: fromHex("3045022059cd6c2a30227afbd693d87b201d0989435d6e116c144276a5223466a822c0f2022100b01495efda969b3fd3a2c05aa098a4e04b0d0e748726fc6174627da15b143799"),
        },
        {
          message: fromHex("2b49de971bb0f705a3fb5914eb7638d72884a6c3550667dbfdf301adf26bde02f387fd426a31be6c9ff8bfe8690c8113c88576427f1466508458349fc86036afcfb66448b947707e791e71f558b2bf4e7e7507773aaf4e9af51eda95cbce0a0f752b216f8a54a045d47801ff410ee411a1b66a516f278327df2462fb5619470e"),
          privkey: fromHex("2258cdecaf3510bc398d08c000245cadceadcf149022730d93b176b4844713e1"),
          signature: fromHex("30460221009eaf69170aeba44966afe957295526ee9852b5034c18dc5aeef3255c8567838a022100ebd4c8de2c22b5cb8803d6e070186786f6d5dae2202b9f899276fa31a66cb3bb"),
        },
        {
          message: fromHex("1fa7201d96ad4d190415f2656d1387fa886afc38e5cd18b8c60da367acf32c627d2c9ea19ef3f030e559fc2a21695cdbb65ddf6ba36a70af0d3fa292a32de31da6acc6108ab2be8bd37843338f0c37c2d62648d3d49013edeb9e179dadf78bf885f95e712fcdfcc8a172e47c09ab159f3a00ed7b930f628c3c48257e92fc7407"),
          privkey: fromHex("a67cf8cead99827c7956327aa04ab30cfd2d67f21b78f28a35694ece51052a61"),
          signature: fromHex("304402210091058d1b912514940e1002855cc930c01a21234bad88f607f213af495c32b69f021f5d387ce3de25f1b9bad1fb180de110686d91b461ae2972fa4e4a7018519870"),
        },
        {
          message: fromHex("74715fe10748a5b98b138f390f7ca9629c584c5d6ad268fc455c8de2e800b73fa1ea9aaee85de58baa2ce9ce68d822fc31842c6b153baef3a12bf6b4541f74af65430ae931a64c8b4950ad1c76b31aea8c229b3623390e233c112586aa5907bbe419841f54f0a7d6d19c003b91dc84bbb59b14ec477a1e9d194c137e21c75bbb"),
          privkey: fromHex("4f1050422c4fce146bab0d735a70a91d6447210964b064309f90315c986be400"),
          signature: fromHex("3046022100fe43eb9c38b506d118e20f8605ac8954fc0406efd306ba7ea5b07577a2735d15022100d589e91bf5014c7c360342ad135259dd7ae684e2c21234d7a912b43d148fcf19"),
        },
        {
          message: fromHex("d10131982dd1a1d839aba383cd72855bf41061c0cb04dfa1acad3181f240341d744ca6002b52f25fb3c63f16d050c4a4ef2c0ebf5f16ce987558f4b9d4a5ad3c6b81b617de00e04ba32282d8bf223bfedbb325b741dfdc8f56fa85c65d42f05f6a1330d8cc6664ad32050dd7b9e3993f4d6c91e5e12cbd9e82196e009ad22560"),
          privkey: fromHex("79506f5f68941c60a0d7c62595652a5f42f2b9f5aa2b6456af1c56a79a346c2f"),
          signature: fromHex("3046022100ccdbbd2500043bf7f705536d5984ab5f05fdc0fa3cf464d8c88f861e3fc8e54c022100d5c6342c08dcd8242e1daf3595cae968e320a025aa45ec4bc725795da3d1becb"),
        },
        {
          message: fromHex("ef9dbd90ded96ad627a0a987ab90537a3e7acc1fdfa991088e9d999fd726e3ce1e1bd89a7df08d8c2bf51085254c89dc67bc21e8a1a93f33a38c18c0ce3880e958ac3e3dbe8aec49f981821c4ac6812dd29fab3a9ebe7fbd799fb50f12021b48d1d9abca8842547b3b99befa612cc8b4ca5f9412e0352e72ab1344a0ac2913db"),
          privkey: fromHex("4c53b8e372f70593afb08fb0f3ba228e1bd2430f562414e9bd1b89e53becbac8"),
          signature: fromHex("304402205c707b6df7667324f950216b933d28e307a0223b24d161bc5887208d7f880b3a02204b7bc56586dc51d806ac3ad72807bc62d1d06d0812f121bd91e9770d84885c39"),
        },
      ];

      for (const [index, row] of data.entries()) {
        const pubkey = (await Secp256k1.makeKeypair(row.privkey)).pubkey;
        const isValid = await Secp256k1.verifySignature(row.signature, row.message, pubkey);
        since(`(index ${index}) #{message}`)
          .expect(isValid)
          .toEqual(true);
      }

      done();
    })().catch(error => {
      setTimeout(() => {
        throw error;
      });
    });
  });

  it("matches normalized pyca/cryptography signatures", done => {
    (async () => {
      // signatures are normalized to lowS
      const data: ReadonlyArray<any> = [
        {
          message: fromHex("5c868fedb8026979ebd26f1ba07c27eedf4ff6d10443505a96ecaf21ba8c4f0937b3cd23ffdc3dd429d4cd1905fb8dbcceeff1350020e18b58d2ba70887baa3a9b783ad30d3fbf210331cdd7df8d77defa398cdacdfc2e359c7ba4cae46bb74401deb417f8b912a1aa966aeeba9c39c7dd22479ae2b30719dca2f2206c5eb4b7"),
          privkey: fromHex("1812bcfaa7566ba0724846d47dd4cc39306a506382cba33710ce6abd4d86553c"),
          signature: fromHex("3044022045c0b7f8c09a9e1f1cea0c25785594427b6bf8f9f878a8af0b1abbb48e16d09202200d8becd0c220f67c51217eecfd7184ef0732481c843857e6bc7fc095c4f6b788"),
        },
        {
          message: fromHex("17cd4a74d724d55355b6fb2b0759ca095298e3fd1856b87ca1cb2df5409058022736d21be071d820b16dfc441be97fbcea5df787edc886e759475469e2128b22f26b82ca993be6695ab190e673285d561d3b6d42fcc1edd6d12db12dcda0823e9d6079e7bc5ff54cd452dad308d52a15ce9c7edd6ef3dad6a27becd8e001e80f"),
          privkey: fromHex("1aea57ea357cecc13b876b76a1825f433ff603d76e6794fdb55aeda481b9482b"),
          signature: fromHex("304402204e0ea79d4a476276e4b067facdec7460d2c98c8a65326a6e5c998fd7c650611402200e45aea5034af973410e65cf97651b3f2b976e3fc79c6a93065ed7cb69a2ab5a"),
        },
        {
          message: fromHex("db0d31717b04802adbbae1997487da8773440923c09b869e12a57c36dda34af11b8897f266cd81c02a762c6b74ea6aaf45aaa3c52867eb8f270f5092a36b498f88b65b2ebda24afe675da6f25379d1e194d093e7a2f66e450568dbdffebff97c4597a00c96a5be9ba26deefcca8761c1354429622c8db269d6a0ec0cc7a8585c"),
          privkey: fromHex("03708999fddd22091e93a8fd6b2205b662089a97507623cb5ce04240bcae55b8"),
          signature: fromHex("3045022100f25b86e1d8a11d72475b3ed273b0781c7d7f6f9e1dae0dd5d3ee9b84f3fab891022063d9c4e1391de077244583e9a6e3d8e8e1f236a3bf5963735353b93b1a3ba935"),
        },
        {
          message: fromHex("47c9deddfd8c841a63a99be96e972e40fa035ae10d929babfc86c437b9d5d495577a45b7f8a35ce3f880e7d8ae8cd8eb685cf41f0506e68046ccf5559232c674abb9c3683829dcc8002683c4f4ca3a29a7bfde20d96dd0f1a0ead847dea18f297f220f94932536ca4deacedc2c6701c3ee50e28e358dcc54cdbf69daf0eb87f6"),
          privkey: fromHex("44da7ab9eab17b93175bf4d5388c6b334f35a3283215b9e602a264d2e831fea3"),
          signature: fromHex("3045022100f2cab57d108aaf7c9c9dd061404447d59f968d1468b25dd827d624b64601c32a022077558dbf7bf90885b9128c371959085e9dd1b7d8a5c45b7265e8e7d9f125c008"),
        },
        {
          message: fromHex("f15433188c2bbc93b2150bb2f34d36ba8ae49f8f7e4e81aed651c8fb2022b2a7e851c4dbbbc21c14e27380316bfdebb0a049246349537dba687581c1344e40f75afd2735bb21ea074861de6801d28b22e8beb76fdd25598812b2061ca3fba229daf59a4ab416704543b02e16b8136c22acc7e197748ae19b5cbbc160fdc3a8cd"),
          privkey: fromHex("5452b1bf1b1d96929f7ee3637a1bca637490f97634e6d164aeddda3dbb243a26"),
          signature: fromHex("3045022100d702bec0f058f5e18f5fcdb204f79250562f11121f5513ae1006c9b93ddafb11022063de551c508405a280a21fb007b660542b58fcd3256b7cea45e3f2ebe9a29ecd"),
        },
        {
          message: fromHex("1bc796124b87793b7f7fdd53b896f8f0d0f2d2be36d1944e3c2a0ac5c6b2839f59a4b4fad200f8035ec98630c51ef0d40863a5ddd69b703d73f06b4afae8ad1a88e19b1b26e8c10b7bff953c05eccc82fd771b220910165f3a906b7c931683e431998d1fd06c32dd11b4f872bf980d547942f22124c7e50c9523321aee23a36d"),
          privkey: fromHex("a4095a3d464d20ea154f4312c087bd22c8a92207717cca40b1f3267e13cbf05c"),
          signature: fromHex("3045022100ae17ab6a3bd2ccd0901cc3904103e825895540bf416a5f717b74b529512e4c1802204bc049a8a2287cfccea77fb3769755ba92c35154c635448cf633244edf4f6fe1"),
        },
        {
          message: fromHex("18e55ac264031da435b613fc9dc6c4aafc49aae8ddf6f220d523415896ff915fae5c5b2e6aed61d88e5721823f089c46173afc5d9b47fd917834c85284f62dda6ed2d7a6ff10eb553b9312b05dad7decf7f73b69479c02f14ea0a2aa9e05ec07396cd37c28795c90e590631137102315635d702278e352aa41d0826adadff5e1"),
          privkey: fromHex("4babce8321dcd2b5e3ac936e278519fb4b9be96688bbefb2e87d53b863a349b8"),
          signature: fromHex("3044022003b51d02eac41f2969fc36c816c9772da21a139376b09d1c8809bb8f543be62f02200629c1396ae304d2c2e7b63890d91e56dfc3459f4d664cb914c7ff2a12a21925"),
        },
        {
          message: fromHex("a5290666c97294d090f8da898e555cbd33990579e5e95498444bfb318b4aa1643e0d4348425e21c7c6f99f9955f3048f56c22b68c4a516af5c90ed5268acc9c5a20fec0200c2a282a90e20d3c46d4ecdda18ba18b803b19263de2b79238da921707a0864799cdee9f02913b40681c02c6923070688844b58fe415b7d71ea6845"),
          privkey: fromHex("02f98a6eb5320fc0c65f3eb2911b8500bedf47230bdfa2ba5e1c0c1c0bf9fc0a"),
          signature: fromHex("30440220400f52f4c4925b4b8886706331535230fafb6455c3a3eef6fbf19a82593812300220727cc4b3341d7d95d0dc404d910dc009b3b5f21baadc0c4ee199a46e558d7f56"),
        },
        {
          message: fromHex("13ad0600229c2a66b2f11617f69c7210ad044c49265dc98ec3c64f56e56a083234d277d404e2c40523c414ad23af5cc2f91a47fe59e7ca572f7fe1d3d3cfceaedadac4396749a292a38e92727273272335f12b2acea21cf069682e67d7e7d7a31ab5bb8e472298a9451aeae6f160f36e6623c9b632b9c93371a002818addc243"),
          privkey: fromHex("f2a08a52b0edbaa64dacb3244666d4fdb684e6cc995bed81ec9d86c58f9999de"),
          signature: fromHex("3045022100b2927afc8856b7e14d02e01e7aa3c76951a4621bfde5d794adda165b51dbe198022006eee6e0b087143ed06933cba699fbe4097ba7d7b038b173cbbd183718a86d43"),
        },
        {
          message: fromHex("51ad843da5eafc177d49a50a82609555e52773c5dfa14d7c02db5879c11a6b6e2e0860df38452dc579d763f91a83ade23b73f4fcbd703f35dd6ecfbb4c9578d5b604ed809c8633e6ac5679a5f742ce94fea3b97b5ba8a29ea28101a7b35f9eaa894dda54e3431f2464d18faf8342b7c59dfe0598c0ab29a14622a08eea70126b"),
          privkey: fromHex("e27f10d444fa50b53283863941619b11d585b27018b0e29301371371b45e3c65"),
          signature: fromHex("3044022100fe9717965673fbe585780e18d892a3cfa77b59ac2f44f5337a3e58ce6ecd4409021f155459b19d2e9a2e676d7d8d48a9303391ffb9befdd3a57324306d69e0e0ab"),
        },
      ];

      for (const [index, row] of data.entries()) {
        const keypair = await Secp256k1.makeKeypair(row.privkey);

        // create signature
        const calculatedSignature = await Secp256k1.createSignature(row.message, row.privkey);
        since(`(index ${index}) #{message}`)
          .expect(toHex(calculatedSignature))
          .toEqual(toHex(row.signature));

        // verify calculated signature
        const ok1 = await Secp256k1.verifySignature(calculatedSignature, row.message, keypair.pubkey);
        since(`(index ${index}) #{message}`)
          .expect(ok1)
          .toEqual(true);

        // verify original signature
        const ok2 = await Secp256k1.verifySignature(row.signature, row.message, keypair.pubkey);
        since(`(index ${index}) #{message}`)
          .expect(ok2)
          .toEqual(true);

        // compare signatures
        since(`(index ${index}) #{message}`)
          .expect(calculatedSignature)
          .toEqual(row.signature);
      }

      done();
    })().catch(error => {
      setTimeout(() => {
        throw error;
      });
    });
  });
});
